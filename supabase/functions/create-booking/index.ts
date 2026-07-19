import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { notifyZapierBooking, STUDIO_LABELS } from "../_shared/zapier.ts";
import { provisionBookingAccess } from "../_shared/nuki.ts";
import { computeStudioPricing, DEFAULT_OFFPEAK, type OffPeakConfig } from "../_shared/pricing.ts";
import { maybeGenerateSessionPlan } from "../_shared/coach.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STUDIO_PRICES: Record<string, number> = {
  "studio-1": 50,
  "studio-2": 30,
  "content-room": 35,
};

const TIMEZONE = "Europe/Amsterdam";

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

// Defaults; overridable per extra via the booking_rules app_config row
const EXTRAS_PRICES: Record<string, number> = {
  "mix-master": 150,
  "photographer": 0,
  "session-recap": 49,
  "bts-pack": 35,
  "session-photos": 40,
};

const VALID_STUDIOS = new Set(Object.keys(STUDIO_PRICES));
const VALID_DURATIONS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

const TIER_CONFIG: Record<string, { maxHoursPerMonth: number; maxUpcomingBookings: number }> = {
  basic: { maxHoursPerMonth: 8, maxUpcomingBookings: 2 },
  pro: { maxHoursPerMonth: 16, maxUpcomingBookings: 2 },
  unlimited: { maxHoursPerMonth: Infinity, maxUpcomingBookings: 2 },
  // Ambassadeur: hours are individually allocated by admin via studio1_hours/studio2_hours/content_hours.
  // No monthly cap on the tier itself — usage is gated by the assigned credit hours per studio.
  ambassadeur: { maxHoursPerMonth: Infinity, maxUpcomingBookings: 2 },
};

function getTierFromProductName(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes("unlimited")) return "unlimited";
  if (lower.includes("pro")) return "pro";
  return "basic";
}

const STUDIO_CREDIT_FIELD: Record<string, string> = {
  "studio-1": "studio1_hours",
  "studio-2": "studio2_hours",
  "content-room": "content_hours",
};

const STUDIO_DISPLAY_NAME: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};

/** A room with an active block (fault report / maintenance) is not bookable. */
async function isRoomBlocked(
  supabaseAdmin: any,
  studio_id: string,
  booking_date: string,
  start_time: string,
): Promise<boolean> {
  const { data: blocks } = await supabaseAdmin
    .from("room_blocks")
    .select("blocked_until")
    .eq("studio_id", studio_id)
    .eq("active", true);
  if (!blocks || blocks.length === 0) return false;
  const [h, m] = start_time.split(":").map(Number);
  const sessionStart = buildLocalDate(booking_date, h, m);
  return blocks.some((b: any) => !b.blocked_until || new Date(b.blocked_until) > sessionStart);
}

async function checkAvailability(
  supabaseAdmin: any,
  studio_id: string,
  booking_date: string,
  start_time: string,
  duration_hours: number
): Promise<boolean> {
  const startHour = parseInt(start_time.split(":")[0], 10);
  const startMin = parseInt(start_time.split(":")[1] || "0", 10);
  const requestedStart = startHour * 60 + startMin;
  const requestedEnd = requestedStart + duration_hours * 60;

  const { data: existing } = await supabaseAdmin
    .from("bookings")
    .select("start_time, duration_hours")
    .eq("studio_id", studio_id)
    .eq("booking_date", booking_date)
    .in("status", ["confirmed", "pending_payment", "pending"]);

  if (!existing || existing.length === 0) return true;

  for (const b of existing) {
    const bHour = parseInt(b.start_time.split(":")[0], 10);
    const bMin = parseInt(b.start_time.split(":")[1] || "0", 10);
    const bStart = bHour * 60 + bMin;
    const bEnd = bStart + b.duration_hours * 60;
    if (requestedStart < bEnd && requestedEnd > bStart) return false;
  }
  return true;
}

async function checkMemberLimits(
  supabaseAdmin: any,
  userId: string,
  tier: string,
  requestedDuration: number
): Promise<{ allowed: boolean; error?: string; hoursUsed?: number; upcomingCount?: number }> {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.basic;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthStart = `${year}-${month}-01`;
  const nextMonth = now.getMonth() + 2 > 12
    ? `${year + 1}-01-01`
    : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

  const { data: monthBookings } = await supabaseAdmin
    .from("bookings")
    .select("duration_hours")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .eq("session_type", "member")
    .gte("booking_date", monthStart)
    .lt("booking_date", nextMonth);

  const hoursUsed = (monthBookings || []).reduce((sum: number, b: any) => sum + (b.duration_hours || 0), 0);

  if (config.maxHoursPerMonth !== Infinity) {
    if (hoursUsed + requestedDuration > config.maxHoursPerMonth) {
      const remaining = config.maxHoursPerMonth - hoursUsed;
      return {
        allowed: false,
        hoursUsed,
        error: `Je hebt nog ${remaining} uur over van je ${config.maxHoursPerMonth} uur limiet deze maand. Je probeert ${requestedDuration} uur te boeken.`,
      };
    }
  }

  const todayStr = now.toISOString().split("T")[0];
  const { data: upcomingBookings } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .eq("session_type", "member")
    .gte("booking_date", todayStr);

  const upcomingCount = (upcomingBookings || []).length;

  if (upcomingCount >= config.maxUpcomingBookings) {
    return {
      allowed: false,
      hoursUsed,
      upcomingCount,
      error: `Je kunt maximaal ${config.maxUpcomingBookings} boeking${config.maxUpcomingBookings > 1 ? "en" : ""} tegelijk hebben. Wacht tot je huidige sessie voorbij is.`,
    };
  }

  return { allowed: true, hoursUsed, upcomingCount };
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { studio_id, booking_date, start_time, duration_hours, extras, photographer_notes, use_wallet } = body;

    if (!studio_id || !VALID_STUDIOS.has(studio_id)) {
      return new Response(JSON.stringify({ error: "Invalid studio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!duration_hours || !VALID_DURATIONS.has(duration_hours)) {
      return new Response(JSON.stringify({ error: "Invalid duration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!booking_date || !start_time) {
      return new Response(JSON.stringify({ error: "Date and time required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(booking_date) || isNaN(Date.parse(booking_date))) {
      return new Response(JSON.stringify({ error: "Invalid date format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Use Amsterdam timezone for "today" check
    const nowAmsterdam = new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
    const todayStr = `${nowAmsterdam.getFullYear()}-${String(nowAmsterdam.getMonth() + 1).padStart(2, "0")}-${String(nowAmsterdam.getDate()).padStart(2, "0")}`;
    if (booking_date < todayStr) {
      return new Response(JSON.stringify({ error: "Cannot book a date in the past" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // If booking today, check that the start time hasn't passed yet
    if (booking_date === todayStr) {
      const nowHour = nowAmsterdam.getHours();
      const nowMin = nowAmsterdam.getMinutes();
      const [bookHour, bookMin] = start_time.split(":").map(Number);
      if (bookHour < nowHour || (bookHour === nowHour && bookMin <= nowMin)) {
        return new Response(JSON.stringify({ error: "Dit tijdstip is al verstreken." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(start_time)) {
      return new Response(JSON.stringify({ error: "Invalid time format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Config-driven pricing: booking_rules extras + off-peak settings can be
    // overridden via app_config without a deploy.
    const { data: configRows } = await supabaseAdmin
      .from("app_config")
      .select("config_key, config_value")
      .in("config_key", ["booking_rules", "offpeak_pricing"])
      .eq("is_active", true);
    const configMap = new Map((configRows || []).map((r: any) => [r.config_key, r.config_value]));

    const extrasPrices: Record<string, number> = { ...EXTRAS_PRICES };
    const configExtras = (configMap.get("booking_rules") as any)?.extras;
    if (Array.isArray(configExtras)) {
      for (const ex of configExtras) {
        if (ex && typeof ex.id === "string" && typeof ex.price === "number") {
          extrasPrices[ex.id] = ex.price;
        }
      }
    }

    const offPeakCfg: OffPeakConfig = { ...DEFAULT_OFFPEAK, ...((configMap.get("offpeak_pricing") as object) || {}) };

    const safeExtras: string[] = [];
    if (Array.isArray(extras)) {
      for (const e of extras) {
        if (typeof e === "string" && e in extrasPrices) safeExtras.push(e);
      }
    }

    // --- Check availability ---
    if (await isRoomBlocked(supabaseAdmin, studio_id, booking_date, start_time)) {
      return new Response(JSON.stringify({ error: "Deze ruimte is tijdelijk niet boekbaar vanwege een storing of onderhoud." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isAvailable = await checkAvailability(supabaseAdmin, studio_id, booking_date, start_time, duration_hours);
    if (!isAvailable) {
      return new Response(JSON.stringify({ error: "Dit tijdslot is niet meer beschikbaar. Kies een ander tijdstip." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Check membership & credit hours ---
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let isMember = false;
    let memberTier = "basic";

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("membership, membership_override, studio1_hours, studio2_hours, content_hours")
      .eq("id", user.id)
      .single();

    const creditField = STUDIO_CREDIT_FIELD[studio_id] || "studio1_hours";
    const creditHours = profile?.[creditField] || 0;

    if (profile?.membership) {
      isMember = true;
      memberTier = profile.membership.toLowerCase();
    }
    // Apply membership_override for tier limits (e.g. pro user with unlimited hours)
    let effectiveTier = profile?.membership_override?.toLowerCase() || memberTier;

    if (!isMember && stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      try {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
          if (subs.data.length > 0) {
            isMember = true;
            const productId = subs.data[0].items.data[0].price.product as string;
            try {
              const product = await stripe.products.retrieve(productId);
              memberTier = getTierFromProductName(product.name);
            } catch {
              memberTier = "basic";
            }
            // Re-evaluate effectiveTier with Stripe result
            effectiveTier = profile?.membership_override?.toLowerCase() || memberTier;
          }
        }
      } catch (e) {
        console.error("[CREATE-BOOKING] Membership check failed:", e);
      }
    }

    // --- Enforce member booking limits (use effectiveTier for overrides) ---
    if (isMember) {
      const limitCheck = await checkMemberLimits(supabaseAdmin, user.id, effectiveTier, duration_hours);
      if (!limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.error }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Calculate price ---
    // Members: free. Credit hours: free up to available credits, pay for overflow.
    let freeHours = 0;
    let paidHours = duration_hours;
    const sessionType = isMember ? "member" : (creditHours > 0 ? "credit" : "single");

    if (isMember) {
      freeHours = duration_hours;
      paidHours = 0;
    } else if (creditHours > 0) {
      freeHours = Math.min(creditHours, duration_hours);
      paidHours = duration_hours - freeHours;
    }

    const studioPricing = computeStudioPricing(
      STUDIO_PRICES[studio_id],
      booking_date,
      start_time,
      duration_hours,
      duration_hours - paidHours,
      offPeakCfg,
    );
    const extrasPrice = safeExtras.reduce((sum, eId) => sum + (extrasPrices[eId] || 0), 0);
    const totalPrice = Math.round((studioPricing.total + extrasPrice) * 100) / 100;

    const bookingNotes = safeExtras.includes("photographer") && typeof photographer_notes === "string" && photographer_notes.trim()
      ? `Fotograaf/Content Creator aanvraag: ${photographer_notes.trim().slice(0, 500)}`
      : null;

    // Apply wallet credit when requested: covers (part of) the price, the
    // remainder goes through Stripe. Actual deduction happens after insert via
    // wallet_apply(), which guards against concurrent spends.
    let walletApplied = 0;
    if (use_wallet === true && totalPrice > 0) {
      const { data: walletProfile } = await supabaseAdmin
        .from("profiles").select("credit_balance").eq("id", user.id).single();
      walletApplied = Math.min(Number(walletProfile?.credit_balance || 0), totalPrice);
      if (walletApplied < 0) walletApplied = 0;
    }

    let needsPayment = totalPrice - walletApplied > 0;

    const { data: booking, error: insertError } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: user.id,
        studio_id,
        booking_date,
        start_time,
        duration_hours,
        session_type: sessionType,
        extras: safeExtras,
        total_price: totalPrice,
        wallet_applied: walletApplied,
        status: needsPayment ? "pending_payment" : "confirmed",
        notes: bookingNotes,
      })
      .select("id")
      .single();

    if (insertError) {
      // 23P01 = exclusion constraint (bookings_no_overlap): someone grabbed the
      // slot between our availability pre-check and this insert.
      if (insertError.code === "23P01") {
        return new Response(JSON.stringify({ error: "Dit tijdslot is niet meer beschikbaar. Kies een ander tijdstip." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[CREATE-BOOKING] Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create booking" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct wallet credit; on failure (balance spent concurrently) fall back
    // to full payment via Stripe instead of failing the booking.
    if (walletApplied > 0) {
      const { error: walletErr } = await supabaseAdmin.rpc("wallet_apply", {
        p_user_id: user.id,
        p_amount: -walletApplied,
        p_type: "spend",
        p_booking_id: booking.id,
        p_note: `Boeking ${STUDIO_DISPLAY_NAME[studio_id] || studio_id} ${booking_date} ${start_time}`,
      });
      if (walletErr) {
        console.error("[CREATE-BOOKING] wallet_apply failed, falling back to full payment:", walletErr);
        walletApplied = 0;
        needsPayment = totalPrice > 0;
        await supabaseAdmin.from("bookings").update({
          wallet_applied: 0,
          status: needsPayment ? "pending_payment" : "confirmed",
          updated_at: new Date().toISOString(),
        }).eq("id", booking.id);
      }
    }

    // Deduct credit hours if used
    if (!isMember && freeHours > 0) {
      const newValue = creditHours - freeHours;
      await supabaseAdmin
        .from("profiles")
        .update({ [creditField]: newValue, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    // Send confirmation notification and provision Nuki access for free/member bookings
    if (!needsPayment) {
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        title: "Boeking bevestigd!",
        message: `Je ${STUDIO_DISPLAY_NAME[studio_id] || studio_id} sessie op ${booking_date} om ${start_time} is bevestigd.`,
        type: "success",
        link: "/account?tab=bookings",
      });

      // Notify all admins about the new booking
      const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).single();
      const userName = profile?.full_name || profile?.email || "Onbekend";
      const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
      if (adminRoles && adminRoles.length > 0) {
        const adminNotifications = adminRoles.map((r: any) => ({
          user_id: r.user_id,
          title: "Nieuwe boeking",
          message: `${userName} heeft ${STUDIO_DISPLAY_NAME[studio_id] || studio_id} geboekt op ${booking_date} om ${start_time} (${sessionType}).`,
          type: "info",
          link: "/admin?tab=calendar",
        }));
        await supabaseAdmin.from("notifications").insert(adminNotifications);
      }

      // Auto-provision booking-scoped door access (app-based front-door unlock)
      const provision = await provisionBookingAccess(supabaseAdmin, booking.id);
      if (!provision.ok) {
        console.error("[CREATE-BOOKING] Nuki provisioning failed:", provision.reason);
      }

      // Coach users: auto-generate a session shot list + post plan
      await maybeGenerateSessionPlan(supabaseAdmin, booking.id, user.id);

      await notifyZapierBooking({
        naam: userName,
        email: profile?.email ?? user.email ?? "",
        datum: booking_date,
        tijd: start_time,
        studio: STUDIO_LABELS[studio_id] || studio_id,
        type: "studio",
        duration_hours,
        source: "create-booking",
      });
    }

    if (!needsPayment) {
      return new Response(JSON.stringify({ success: true, booking_id: booking.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Create Stripe checkout for payment ---
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Payment not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Studio Booking - ${STUDIO_DISPLAY_NAME[studio_id] || studio_id}`,
            ...(walletApplied > 0 ? { description: `€${walletApplied} tegoed verrekend` } : {}),
          },
          unit_amount: Math.round((totalPrice - walletApplied) * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      payment_method_types: ["card", "ideal"],
      success_url: `${Deno.env.get("APP_URL") || "https://app.uprisingstudio.nl"}/account?payment=success&tab=bookings&type=studio-booking&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get("APP_URL") || "https://app.uprisingstudio.nl"}/book?payment=cancelled`,

      metadata: {
        user_id: user.id,
        booking_id: booking.id,
        type: "studio-booking",
      },
    });

    await supabaseAdmin
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", booking.id);

    return new Response(JSON.stringify({ url: session.url, booking_id: booking.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CREATE-BOOKING] ERROR:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});