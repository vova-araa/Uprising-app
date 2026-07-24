import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Stripe price IDs for memberships
const MEMBERSHIP_PRICES: Record<string, { monthly: string; yearly: string }> = {
  basic: {
    monthly: "price_1T9anJEKfqpl7HmEIJF59MFN",
    yearly: "price_1T9anREKfqpl7HmEj6dljNGq",
  },
  pro: {
    monthly: "price_1T9anTEKfqpl7HmExWH3EAEw",
    yearly: "price_1T9anUEKfqpl7HmEEPRci76F",
  },
  unlimited: {
    monthly: "price_1T9anVEKfqpl7HmEuEH10dkV",
    yearly: "price_1T9anWEKfqpl7HmErQfwG4xs",
  },
  "broedplaats-students": {
    monthly: "price_1TAMyuEKfqpl7HmERLbcPms5",
    yearly: "price_1TAMyuEKfqpl7HmERLbcPms5",
  },
  "broedplaats": {
    monthly: "price_1TAMywEKfqpl7HmEscosxJw1",
    yearly: "price_1TAMywEKfqpl7HmEscosxJw1",
  },
  "broedplaats-plus": {
    monthly: "price_1TAMywEKfqpl7HmE1FWoV9GX",
    yearly: "price_1TAMywEKfqpl7HmE1FWoV9GX",
  },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Ensure a Stripe promotion code exists for a referral code
async function ensurePromotionCode(stripe: Stripe, referralCode: string): Promise<void> {
  try {
    // Check if promotion code already exists
    const existing = await stripe.promotionCodes.list({ code: referralCode, limit: 1 });
    if (existing.data.length > 0) {
      logStep("Promotion code already exists", { code: referralCode });
      return;
    }

    // Create a coupon for €50/month recurring discount (forever, as long as referrer's sub is active)
    const coupon = await stripe.coupons.create({
      amount_off: 5000, // €50 in cents
      currency: "eur",
      duration: "forever",
      name: `Referral ${referralCode}`,
    });

    // Create a promotion code linked to the coupon
    await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: referralCode,
      max_redemptions: 1,
    });

    logStep("Created Stripe promotion code", { code: referralCode, couponId: coupon.id });
  } catch (err) {
    logStep("Error creating promotion code (non-fatal)", { error: String(err) });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logStep("User authenticated", { email: user.email });

    const body = await req.json();
    const { plan, interval, booking_data } = body;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Ensure the user's referral code exists as a Stripe promotion code
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", user.id)
      .single();
    
    if (profile?.referral_code) {
      await ensurePromotionCode(stripe, profile.referral_code);
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = Deno.env.get("APP_URL") || "https://app.uprisingstudio.nl";

    // Membership subscription checkout using Stripe price IDs
    if (plan && MEMBERSHIP_PRICES[plan]) {
      const isYearly = interval === "year";
      const priceId = isYearly ? MEMBERSHIP_PRICES[plan].yearly : MEMBERSHIP_PRICES[plan].monthly;

      logStep("Creating membership checkout", { plan, interval, priceId });

      const sessionParams: any = {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: "subscription",
        payment_method_types: ["card", "ideal"],
        success_url: `${origin}/account?payment=success&tab=bookings&type=membership&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/book?payment=cancelled`,
        allow_promotion_codes: true,
        consent_collection: {
          terms_of_service: "required",
        },
        custom_text: {
          terms_of_service_acceptance: {
            message: plan.startsWith("broedplaats")
              ? "Ik ga akkoord met de [Algemene Voorwaarden](https://uprising-nl.lovable.app/services?tab=memberships) van Uprising Studio. Maandelijks opzegbaar."
              : isYearly
              ? "Ik ga akkoord met de [Algemene Voorwaarden](https://uprising-nl.lovable.app/services?tab=memberships) van Uprising Studio. Dit betreft een jaarcontract van 12 maanden."
              : "Ik ga akkoord met de [Algemene Voorwaarden](https://uprising-nl.lovable.app/services?tab=memberships) van Uprising Studio. Dit betreft een 3-maanden commitment, maandelijks gefactureerd.",
          },
        },
        metadata: {
          user_id: user.id,
          type: "membership",
          plan,
          interval: isYearly ? "year" : "quarter",
        },
      };

      // For non-yearly (3-month commitment), don't allow cancellation before 3 months
      // by not setting trial but using subscription_data to enforce minimum billing
      if (!isYearly && !plan.startsWith("broedplaats")) {
        // Stripe doesn't have min_billing_cycles in checkout, but we can use
        // cancel_at to prevent early cancellation - handled via customer portal config
        // The contract terms in the UI and checkout make this binding
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      logStep("Membership checkout created", { sessionId: session.id });

      // Notify admins about new membership purchase
      const { data: userProfile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).single();
      const memberName = userProfile?.full_name || userProfile?.email || "Onbekend";
      const planLabels: Record<string, string> = { basic: "Basic", pro: "Pro", unlimited: "Unlimited", "broedplaats-students": "Broedplaats Students", "broedplaats": "Broedplaats", "broedplaats-plus": "Broedplaats Plus" };
      const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
      if (adminRoles && adminRoles.length > 0) {
        await supabaseAdmin.from("notifications").insert(
          adminRoles.map((r: any) => ({
            user_id: r.user_id,
            title: "Nieuw membership",
            message: `${memberName} heeft een ${planLabels[plan] || plan} membership (${isYearly ? "jaarlijks" : "maandelijks"}) afgenomen.`,
            type: "info",
            link: "/admin?tab=subscriptions",
          }))
        );
      }

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // One-off payment checkout (mix & master, producer session)
    if (booking_data) {
      let productName = "Uprising Studio Service";
      let unitAmount = 0;

      // Check membership for discount
      let discount = 0;
      const { data: memberProfile } = await supabaseAdmin
        .from("profiles")
        .select("membership")
        .eq("id", user.id)
        .single();

      // Also check active Stripe subscription
      let activePlan: string | null = memberProfile?.membership || null;
      try {
        const checkRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/check-subscription`,
          { headers: { Authorization: authHeader!, "Content-Type": "application/json" } }
        );
        const checkData = await checkRes.json();
        if (checkData?.subscribed && checkData?.plan) {
          activePlan = checkData.plan;
        }
      } catch (e) {
        logStep("Could not check subscription, using profile membership", { error: String(e) });
      }

      if (activePlan === "unlimited") discount = 0.2;
      else if (activePlan === "pro") discount = 0.1;

      logStep("Membership discount", { plan: activePlan, discount });

      if (booking_data.type === "mix-master") {
        const trackCount = Math.max(1, Math.min(50, booking_data.track_count || 1));
        // Fast-track (48h delivery) carries a 50% surcharge on top of the
        // member-discounted price
        const fastTrack = booking_data.turnaround === "fast";
        const pricePerTrack = Math.round(15000 * (1 - discount) * (fastTrack ? 1.5 : 1));
        unitAmount = trackCount * pricePerTrack;
        productName = `Mix & Master - ${trackCount} ${trackCount === 1 ? "track" : "tracks"}${fastTrack ? " (48u fast-track)" : ""}`;
        if (discount > 0) productName += ` (${discount * 100}% member discount)`;
      } else if (booking_data.type === "producer-session") {
        unitAmount = Math.round(35000 * (1 - discount));
        productName = "Producer Session";
        if (discount > 0) productName += ` (${discount * 100}% member discount)`;
      }

      if (unitAmount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Creating one-off checkout", { type: booking_data.type, unitAmount });

      const metadata: Record<string, string> = {
        user_id: user.id,
        type: booking_data.type,
      };

      if (booking_data.type === "mix-master") {
        metadata.track_count = String(booking_data.track_count || 1);
        metadata.description = booking_data.description || "";
        metadata.style = booking_data.style || "";
        metadata.reference = booking_data.reference || "";
        metadata.turnaround = booking_data.turnaround === "fast" ? "fast" : "standard";
      } else if (booking_data.type === "producer-session") {
        // Bind this checkout to the specific producer booking so verify-payment
        // marks exactly that booking paid (no blind "latest pending" match).
        // Require it and confirm the booking belongs to this user.
        const producerBookingId = booking_data.producer_booking_id;
        if (!producerBookingId) {
          return new Response(JSON.stringify({ error: "Missing producer_booking_id" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: pb } = await supabaseAdmin
          .from("producer_bookings")
          .select("id, user_id")
          .eq("id", producerBookingId)
          .maybeSingle();
        if (!pb || pb.user_id !== user.id) {
          return new Response(JSON.stringify({ error: "Invalid producer booking" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        metadata.producer_booking_id = producerBookingId;
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: productName },
            unit_amount: unitAmount,
          },
          quantity: 1,
        }],
        mode: "payment",
        payment_method_types: ["card", "ideal"],
        success_url: `${origin}/account?payment=success&tab=bookings&type=${booking_data.type}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/book?payment=cancelled`,
        metadata,
      });

      logStep("One-off checkout created", { sessionId: session.id });
      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request: provide plan or booking_data" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CREATE-CHECKOUT] ERROR:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
