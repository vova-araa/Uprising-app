// Fault reporting with automatic follow-up:
// - equipment faults reported from an active/upcoming booking block the room
//   for new bookings until an admin resolves the report
// - the reporter is compensated automatically when their paid session is hit
// - admins are alerted immediately with the photo evidence

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_STUDIOS = new Set(["studio-1", "studio-2", "content-room"]);
const VALID_CATEGORIES = new Set(["equipment", "access", "cleanliness", "sound", "other"]);
// Categories that make the room unusable and warrant an automatic block
const BLOCKING_CATEGORIES = new Set(["equipment", "access"]);

const STUDIO_DISPLAY_NAME: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { studio_id, booking_id, category, description, photo_path } = await req.json();

    if (!studio_id || !VALID_STUDIOS.has(studio_id)) {
      return new Response(JSON.stringify({ error: "Ongeldige ruimte" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!category || !VALID_CATEGORIES.has(category)) {
      return new Response(JSON.stringify({ error: "Ongeldige categorie" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return new Response(JSON.stringify({ error: "Beschrijving is verplicht" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate the booking reference (must be the reporter's own)
    let booking: Record<string, unknown> | null = null;
    if (booking_id) {
      const { data } = await supabaseAdmin
        .from("bookings")
        .select("id, user_id, studio_id, booking_date, start_time, duration_hours, total_price, wallet_applied, session_type, status")
        .eq("id", booking_id)
        .eq("user_id", user.id)
        .maybeSingle();
      booking = data;
    }

    // Throttle: max 3 open reports per user (spam guard)
    const { data: openReports } = await supabaseAdmin
      .from("fault_reports")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "open");
    if ((openReports || []).length >= 3) {
      return new Response(JSON.stringify({ error: "Je hebt al meerdere openstaande meldingen. Het team kijkt er zo snel mogelijk naar." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: report, error: insertErr } = await supabaseAdmin
      .from("fault_reports")
      .insert({
        user_id: user.id,
        booking_id: booking ? booking.id : null,
        studio_id,
        category,
        description: String(description).trim().slice(0, 2000),
        photo_path: typeof photo_path === "string" ? photo_path.slice(0, 500) : null,
      })
      .select("id")
      .single();

    if (insertErr || !report) {
      console.error("[REPORT-FAULT] insert failed:", insertErr);
      return new Response(JSON.stringify({ error: "Melding opslaan mislukt" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown> = { report_id: report.id };

    // Auto-block the room for blocking categories reported from a real booking
    // (today or upcoming), until an admin resolves the report.
    const reportedFromBooking = booking && ["confirmed"].includes(String(booking.status));
    if (reportedFromBooking && BLOCKING_CATEGORIES.has(category)) {
      const { error: blockErr } = await supabaseAdmin.from("room_blocks").insert({
        studio_id,
        reason: `Storing gemeld: ${category} — ${String(description).trim().slice(0, 140)}`,
        fault_report_id: report.id,
        created_by: user.id,
      });
      if (!blockErr) results.room_blocked = true;
    }

    // Automatic compensation when the reporter's paid session is disrupted:
    // 25% of what they paid, minimum EUR 10 (only for equipment/access, only
    // once per booking).
    if (reportedFromBooking && BLOCKING_CATEGORIES.has(category)) {
      const paid = Number(booking!.total_price || 0);
      const isToday = String(booking!.booking_date) === new Date().toISOString().split("T")[0];
      if (isToday) {
        const { data: existingComp } = await supabaseAdmin
          .from("wallet_transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "compensation")
          .eq("booking_id", booking!.id as string)
          .limit(1);

        if (!existingComp || existingComp.length === 0) {
          const compensation = Math.max(10, Math.round(paid * 0.25));
          const { error: compErr } = await supabaseAdmin.rpc("wallet_apply", {
            p_user_id: user.id,
            p_amount: compensation,
            p_type: "compensation",
            p_booking_id: booking!.id,
            p_note: `Compensatie storing ${STUDIO_DISPLAY_NAME[studio_id] || studio_id}`,
          });
          if (!compErr) {
            results.compensated = compensation;
            await supabaseAdmin.from("fault_reports")
              .update({ compensation })
              .eq("id", report.id);
          }
        }
      }
    }

    // Alert admins/staff
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).single();
    const who = profile?.full_name || profile?.email || "Onbekend";
    const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
    if (adminRoles && adminRoles.length > 0) {
      await supabaseAdmin.from("notifications").insert(adminRoles.map((r: { user_id: string }) => ({
        user_id: r.user_id,
        title: `🔧 Storing: ${STUDIO_DISPLAY_NAME[studio_id] || studio_id}`,
        message: `${who} meldt (${category}): ${String(description).trim().slice(0, 140)}${results.room_blocked ? " — ruimte geblokkeerd voor nieuwe boekingen" : ""}${results.compensated ? ` — €${results.compensated} compensatie toegekend` : ""}`,
        type: "warning",
        link: "/admin-faciliteiten",
      })));
    }

    // Confirm to the reporter
    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Melding ontvangen",
      message: `Bedankt voor je melding over ${STUDIO_DISPLAY_NAME[studio_id] || studio_id}. Het team is direct op de hoogte gebracht.${results.compensated ? ` Je hebt €${results.compensated} tegoed ontvangen voor het ongemak.` : ""}`,
      type: "success",
      link: "/account?tab=bookings",
    });

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[REPORT-FAULT] ERROR:", error);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
