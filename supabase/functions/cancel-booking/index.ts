import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  CASH_REFUND_HOURS,
  WALLET_REFUND_HOURS,
  WALLET_CREDIT_VALID_DAYS,
  computeRefundPlan,
} from "../_shared/cancellation-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEZONE = "Europe/Amsterdam";

const STUDIO_CREDIT_FIELD: Record<string, string> = {
  "studio-1": "studio1_hours",
  "studio-2": "studio2_hours",
  "content-room": "content_hours",
};

function buildLocalDate(dateStr: string, hours: number, minutes: number): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  let h = hours;
  let m = minutes;
  while (m < 0) { m += 60; h -= 1; }
  while (m >= 60) { m -= 60; h += 1; }
  const naive = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00`);
  const utcDate = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0");
  const localInTz = new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = localInTz.getTime() - utcDate.getTime();
  return new Date(naive.getTime() - offsetMs);
}

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

    const { booking_id, preview } = await req.json();
    if (!booking_id || typeof booking_id !== "string") {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return new Response(JSON.stringify({ error: "Boeking niet gevonden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.user_id !== user.id) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const { data: isStaff } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "staff" });
      if (isAdmin !== true && isStaff !== true) {
        return new Response(JSON.stringify({ error: "Geen toegang" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!["confirmed", "pending_payment", "pending"].includes(booking.status)) {
      return new Response(JSON.stringify({ error: "Deze boeking kan niet meer geannuleerd worden" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [startHour, startMin] = String(booking.start_time).split(":").map(Number);
    const sessionStart = buildLocalDate(booking.booking_date, startHour, startMin);
    const hoursUntilStart = (sessionStart.getTime() - Date.now()) / 3_600_000;

    if (hoursUntilStart < 0) {
      return new Response(JSON.stringify({ error: "Deze sessie is al begonnen of voorbij" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Label bookings refund hours to the shared pool instead of wallet/cash.
    const isLabelBooking = booking.session_type === "label" && booking.label_id;

    const plan = isLabelBooking
      ? { kind: "label_hours" as const, cashAmount: 0, walletAmount: 0, restoreHours: 0, reason: "label_pool", poolHours: booking.duration_hours }
      : computeRefundPlan(booking, hoursUntilStart);

    if (preview === true) {
      return new Response(JSON.stringify({
        preview: true,
        policy: plan,
        hours_until_start: Math.floor(hoursUntilStart * 10) / 10,
        thresholds: { cash_hours: CASH_REFUND_HOURS, wallet_hours: WALLET_REFUND_HOURS },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Apply: mark cancelled first so the slot frees up and the booking
    // can't be double-cancelled (guarded by the status filter).
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_refund: plan.kind,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking_id)
      .in("status", ["confirmed", "pending_payment", "pending"])
      .select("id");

    if (updErr || !updated || updated.length === 0) {
      return new Response(JSON.stringify({ error: "Annuleren mislukt, probeer opnieuw" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown> = {};

    // Label booking: return the hours to the pool, then skip wallet/cash logic
    if (isLabelBooking) {
      const { error: poolErr } = await supabaseAdmin.rpc("label_hours_apply", {
        p_label_id: booking.label_id,
        p_hours: booking.duration_hours,
        p_type: "refund",
        p_artist_id: booking.label_artist_id || null,
        p_booking_id: booking.id,
        p_note: `Annulering ${booking.studio_id} ${booking.booking_date} ${booking.start_time}`,
      });
      if (poolErr) console.error("[CANCEL-BOOKING] label pool refund failed:", poolErr);
      else results.pool_hours_refunded = booking.duration_hours;

      await supabaseAdmin.from("booking_access")
        .update({ access_status: "revoked", updated_at: new Date().toISOString() })
        .eq("booking_id", booking.id);

      return new Response(JSON.stringify({ success: true, policy: plan, ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cash refund via Stripe
    if (plan.cashAmount > 0 && booking.stripe_session_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
          const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          if (paymentIntent) {
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntent,
              amount: Math.round(plan.cashAmount * 100),
            });
            results.stripe_refund_id = refund.id;
          } else {
            // Paid session without an intent (shouldn't happen) — fall back to wallet
            plan.walletAmount += plan.cashAmount;
            plan.cashAmount = 0;
          }
        } catch (e) {
          console.error("[CANCEL-BOOKING] Stripe refund failed, falling back to wallet:", e);
          plan.walletAmount += plan.cashAmount;
          plan.cashAmount = 0;
        }
      } else {
        plan.walletAmount += plan.cashAmount;
        plan.cashAmount = 0;
      }
    }

    // Wallet credit (valid 90 days, visible in the app)
    if (plan.walletAmount > 0) {
      const expiresAt = new Date(Date.now() + WALLET_CREDIT_VALID_DAYS * 24 * 3600 * 1000).toISOString();
      const { error: walletErr } = await supabaseAdmin.rpc("wallet_apply", {
        p_user_id: booking.user_id,
        p_amount: plan.walletAmount,
        p_type: "refund_credit",
        p_booking_id: booking.id,
        p_note: `Annulering ${booking.studio_id} ${booking.booking_date} ${booking.start_time}`,
        p_expires_at: expiresAt,
      });
      if (walletErr) console.error("[CANCEL-BOOKING] wallet_apply failed:", walletErr);
      else results.wallet_credited = plan.walletAmount;
    }

    // Restore studio credit-hours
    if (plan.restoreHours > 0) {
      const field = STUDIO_CREDIT_FIELD[booking.studio_id];
      if (field) {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select(field).eq("id", booking.user_id).single();
        const current = (profile as Record<string, number> | null)?.[field] || 0;
        await supabaseAdmin.from("profiles")
          .update({ [field]: current + plan.restoreHours, updated_at: new Date().toISOString() })
          .eq("id", booking.user_id);
        results.hours_restored = plan.restoreHours;
      }
    }

    // Revoke door access for this booking (the app unlock stops working)
    await supabaseAdmin.from("booking_access")
      .update({ access_status: "revoked", updated_at: new Date().toISOString() })
      .eq("booking_id", booking.id);

    // Waitlist auto-offer: the freed slot goes out to everyone waiting for
    // this studio+date via push + in-app notification (first come first served)
    try {
      const { data: waiting } = await supabaseAdmin
        .from("booking_waitlist")
        .select("id, user_id")
        .eq("studio_id", booking.studio_id)
        .eq("booking_date", booking.booking_date)
        .eq("status", "waiting");

      if (waiting && waiting.length > 0) {
        const title = "Er is een plek vrijgekomen! ⚡";
        const message = `${booking.studio_id === "studio-1" ? "Studio 1" : booking.studio_id === "studio-2" ? "Studio 2" : "Content Room"} heeft weer ruimte op ${booking.booking_date} (${booking.start_time}, ${booking.duration_hours}u). Wie het eerst boekt...`;

        await supabaseAdmin.from("notifications").insert(waiting.map((w: { user_id: string }) => ({
          user_id: w.user_id, title, message, type: "info", link: "/book",
        })));

        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-web-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            user_ids: waiting.map((w: { user_id: string }) => w.user_id),
            title, message, link: "/book",
          }),
        }).catch((e) => console.error("[CANCEL-BOOKING] waitlist push failed:", e));

        await supabaseAdmin.from("booking_waitlist")
          .update({ status: "notified", notified_at: new Date().toISOString() })
          .in("id", waiting.map((w: { id: string }) => w.id));
      }
    } catch (e) {
      console.error("[CANCEL-BOOKING] waitlist notify failed:", e);
    }

    // Notify the user
    const refundText = plan.cashAmount > 0 && plan.walletAmount > 0
      ? `€${plan.cashAmount} wordt teruggestort en €${plan.walletAmount} staat als tegoed in je account.`
      : plan.cashAmount > 0
      ? `€${plan.cashAmount} wordt teruggestort op je rekening.`
      : plan.walletAmount > 0
      ? `€${plan.walletAmount} staat als tegoed in je account (90 dagen geldig).`
      : plan.restoreHours > 0
      ? `${plan.restoreHours} credituren zijn teruggezet.`
      : "";

    await supabaseAdmin.from("notifications").insert({
      user_id: booking.user_id,
      title: "Boeking geannuleerd",
      message: `Je sessie op ${booking.booking_date} om ${booking.start_time} is geannuleerd. ${refundText}`.trim(),
      type: "info",
      link: "/account?tab=bookings",
    });

    // Notify admins/staff
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", booking.user_id).single();
    const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
    if (adminRoles && adminRoles.length > 0) {
      await supabaseAdmin.from("notifications").insert(adminRoles.map((r: { user_id: string }) => ({
        user_id: r.user_id,
        title: "Boeking geannuleerd",
        message: `${profile?.full_name || profile?.email || "Onbekend"} annuleerde ${booking.studio_id} op ${booking.booking_date} ${booking.start_time} (refund: ${plan.kind}).`,
        type: "info",
        link: "/admin?tab=calendar",
      })));
    }

    return new Response(JSON.stringify({ success: true, policy: plan, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CANCEL-BOOKING] ERROR:", error);
    return new Response(JSON.stringify({ error: "Er ging iets mis bij het annuleren" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
