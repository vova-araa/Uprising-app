// Label booking: the label manager (or admin/staff) books a studio session on
// behalf of one of their artists, drawing hours from the label's shared pool.
// Free to the artist; pool is debited with per-artist attribution.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { provisionBookingAccess, buildLocalDate } from "../_shared/nuki.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEZONE = "Europe/Amsterdam";
const VALID_STUDIOS = new Set(["studio-1", "studio-2", "content-room"]);
const VALID_DURATIONS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const STUDIO_DISPLAY_NAME: Record<string, string> = {
  "studio-1": "Studio 1", "studio-2": "Studio 2", "content-room": "Content Room",
};

async function slotAvailable(admin: any, studio_id: string, booking_date: string, start_time: string, duration_hours: number): Promise<boolean> {
  const [h, m] = start_time.split(":").map(Number);
  const reqStart = h * 60 + (m || 0);
  const reqEnd = reqStart + duration_hours * 60;
  const { data } = await admin.from("bookings")
    .select("start_time, duration_hours")
    .eq("studio_id", studio_id).eq("booking_date", booking_date)
    .in("status", ["confirmed", "pending_payment", "pending"]);
  for (const b of data ?? []) {
    const [bh, bm] = String(b.start_time).split(":").map(Number);
    const bStart = bh * 60 + (bm || 0);
    if (reqStart < bStart + (b.duration_hours || 0) * 60 && reqEnd > bStart) return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { label_id, artist_id, studio_id, booking_date, start_time, duration_hours, notes } = await req.json();

    if (!label_id) return new Response(JSON.stringify({ error: "label_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!studio_id || !VALID_STUDIOS.has(studio_id)) return new Response(JSON.stringify({ error: "Ongeldige ruimte" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Number.isInteger(duration_hours) || !VALID_DURATIONS.has(duration_hours)) return new Response(JSON.stringify({ error: "Ongeldige duur" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date) || isNaN(Date.parse(booking_date))) return new Response(JSON.stringify({ error: "Ongeldige datum" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)) return new Response(JSON.stringify({ error: "Ongeldige tijd" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Authorize: manager of this label OR admin/staff
    const { data: label } = await admin.from("labels").select("*").eq("id", label_id).single();
    if (!label) return new Response(JSON.stringify({ error: "Label niet gevonden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isStaff } = await admin.rpc("has_role", { _user_id: user.id, _role: "staff" });
    const { data: isManager } = await admin.rpc("is_label_manager", { _user_id: user.id, _label_id: label_id });
    const authorized = isManager === true || isAdmin === true || isStaff === true;
    if (!authorized) return new Response(JSON.stringify({ error: "Geen toegang tot dit label" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Resolve artist (must belong to the label)
    let artist: any = null;
    if (artist_id) {
      const { data } = await admin.from("label_artists").select("*").eq("id", artist_id).eq("label_id", label_id).maybeSingle();
      if (!data) return new Response(JSON.stringify({ error: "Artiest niet gevonden bij dit label" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      artist = data;
    }

    // Pool must have enough hours
    if (Number(label.hours_balance) < duration_hours) {
      return new Response(JSON.stringify({ error: `Niet genoeg uren in de pot (${label.hours_balance} over, ${duration_hours} nodig).` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Not in the past
    const nowAms = new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
    const todayStr = `${nowAms.getFullYear()}-${String(nowAms.getMonth() + 1).padStart(2, "0")}-${String(nowAms.getDate()).padStart(2, "0")}`;
    if (booking_date < todayStr) return new Response(JSON.stringify({ error: "Datum in het verleden" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Room block + availability
    const { data: blocks } = await admin.from("room_blocks").select("blocked_until").eq("studio_id", studio_id).eq("active", true);
    const [bh, bm] = start_time.split(":").map(Number);
    const sessionStart = buildLocalDate(booking_date, bh, bm);
    if ((blocks || []).some((b: any) => !b.blocked_until || new Date(b.blocked_until) > sessionStart)) {
      return new Response(JSON.stringify({ error: "Deze ruimte is tijdelijk niet boekbaar." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!(await slotAvailable(admin, studio_id, booking_date, start_time, duration_hours))) {
      return new Response(JSON.stringify({ error: "Dit tijdslot is niet beschikbaar." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Booking is owned by the artist's account if linked, else the manager
    const bookingUserId = artist?.user_id || label.manager_user_id || user.id;
    const artistLabel = artist?.name ? ` — ${artist.name}` : "";

    const { data: booking, error: insErr } = await admin.from("bookings").insert({
      user_id: bookingUserId,
      studio_id, booking_date, start_time, duration_hours,
      session_type: "label",
      extras: [],
      total_price: 0,
      status: "confirmed",
      label_id,
      label_artist_id: artist_id || null,
      notes: `Label: ${label.name}${artistLabel}${notes ? ` • ${String(notes).slice(0, 300)}` : ""}`,
    }).select("id").single();

    if (insErr) {
      if ((insErr as { code?: string }).code === "23P01") return new Response(JSON.stringify({ error: "Dit tijdslot is net bezet geraakt." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("[LABEL-BOOK] insert error:", insErr);
      return new Response(JSON.stringify({ error: "Boeking aanmaken mislukt" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Debit the pool (per-artist attribution). If this fails, roll back booking.
    const { error: poolErr } = await admin.rpc("label_hours_apply", {
      p_label_id: label_id,
      p_hours: -duration_hours,
      p_type: "usage",
      p_artist_id: artist_id || null,
      p_booking_id: booking.id,
      p_note: `${STUDIO_DISPLAY_NAME[studio_id]}${artistLabel} • ${booking_date} ${start_time}`,
    });
    if (poolErr) {
      await admin.from("bookings").delete().eq("id", booking.id);
      const insufficient = String(poolErr.message || "").includes("insufficient");
      return new Response(JSON.stringify({ error: insufficient ? "Niet genoeg uren in de pot." : "Uren afboeken mislukt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await provisionBookingAccess(admin, booking.id);

    // Notify the artist's account (if linked) about their session
    if (artist?.user_id) {
      await admin.from("notifications").insert({
        user_id: artist.user_id,
        title: "Sessie ingepland 🎙️",
        message: `${label.name} heeft ${STUDIO_DISPLAY_NAME[studio_id]} voor je geboekt op ${booking_date} om ${start_time} (${duration_hours}u).`,
        type: "success",
        link: "/account?tab=bookings",
      });
    }

    const { data: updated } = await admin.from("labels").select("hours_balance").eq("id", label_id).single();

    return new Response(JSON.stringify({ success: true, booking_id: booking.id, hours_balance: updated?.hours_balance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[LABEL-BOOK] ERROR:", error);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
