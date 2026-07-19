import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map price IDs to plan names
const PRICE_TO_PLAN: Record<string, string> = {
  price_1T9anJEKfqpl7HmEIJF59MFN: "basic",
  price_1T9anREKfqpl7HmEj6dljNGq: "basic",
  price_1T9anTEKfqpl7HmExWH3EAEw: "pro",
  price_1T9anUEKfqpl7HmEEPRci76F: "pro",
  price_1T9anVEKfqpl7HmEuEH10dkV: "unlimited",
  price_1T9anWEKfqpl7HmErQfwG4xs: "unlimited",
  price_1TAMyuEKfqpl7HmERLbcPms5: "broedplaats-students",
  price_1TAMywEKfqpl7HmEscosxJw1: "broedplaats",
  price_1TAMywEKfqpl7HmE1FWoV9GX: "broedplaats-plus",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 100 });

    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Some users can have multiple Stripe customers with the same email.
    // Collect active subscriptions across all matching customers.
    const allActiveSubscriptions: Stripe.Subscription[] = [];

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 10,
      });
      allActiveSubscriptions.push(...subscriptions.data);
    }

    if (allActiveSubscriptions.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Collect all active subscriptions (user may have both studio + broedplaats)
    const plans: Array<{
      plan: string;
      price_id: string;
      product_id: string;
      subscription_id: string;
      subscription_start: string;
      subscription_end: string;
      interval: string;
    }> = [];

    for (const sub of allActiveSubscriptions) {
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? PRICE_TO_PLAN[priceId] : null;
      const productId = sub.items.data[0]?.price?.product as string;
      const interval = sub.items.data[0]?.price?.recurring?.interval || "month";

      plans.push({
        plan: plan || "unknown",
        price_id: priceId || "",
        product_id: productId || "",
        subscription_id: sub.id,
        subscription_start: new Date(sub.start_date * 1000).toISOString(),
        subscription_end: new Date(sub.current_period_end * 1000).toISOString(),
        interval,
      });
    }

    // Primary plan = first studio membership, fallback to first plan
    const studioPlan = plans.find(p => ["basic", "pro", "unlimited"].includes(p.plan));
    const broedplaatsPlan = plans.find(p => p.plan.startsWith("broedplaats"));
    const primaryPlan = studioPlan || plans[0];

    // Sync active subscription to profile so admin dashboard stays up-to-date
    const profileUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    if (studioPlan) profileUpdate.membership = studioPlan.plan;
    if (broedplaatsPlan) profileUpdate.broedplaats = broedplaatsPlan.plan;
    if (Object.keys(profileUpdate).length > 1) {
      await supabaseClient.from("profiles").update(profileUpdate).eq("id", user.id);
    }

    return new Response(JSON.stringify({
      subscribed: true,
      plan: primaryPlan.plan,
      price_id: primaryPlan.price_id,
      product_id: primaryPlan.product_id,
      subscription_id: primaryPlan.subscription_id,
      subscription_start: primaryPlan.subscription_start,
      subscription_end: primaryPlan.subscription_end,
      interval: primaryPlan.interval,
      // Include all plans for multi-subscription users
      all_plans: plans,
      // Convenience flags
      has_studio_membership: !!studioPlan,
      has_broedplaats: !!broedplaatsPlan,
      studio_plan: studioPlan?.plan || null,
      broedplaats_plan: broedplaatsPlan?.plan || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CHECK-SUBSCRIPTION] ERROR:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
