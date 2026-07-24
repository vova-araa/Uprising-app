import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan hierarchy for determining upgrade vs downgrade
const STUDIO_PLAN_ORDER: Record<string, number> = {
  basic: 1,
  pro: 2,
  unlimited: 3,
};

const BROEDPLAATS_PLAN_ORDER: Record<string, number> = {
  "broedplaats-students": 1,
  broedplaats: 2,
  "broedplaats-plus": 3,
};

// All membership price IDs mapped to plan names
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
  broedplaats: {
    monthly: "price_1TAMywEKfqpl7HmEscosxJw1",
    yearly: "price_1TAMywEKfqpl7HmEscosxJw1",
  },
  "broedplaats-plus": {
    monthly: "price_1TAMywEKfqpl7HmE1FWoV9GX",
    yearly: "price_1TAMywEKfqpl7HmE1FWoV9GX",
  },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPDATE-SUBSCRIPTION] ${step}${detailsStr}`);
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logStep("User authenticated", { email: user.email });

    const body = await req.json();
    const { target_plan } = body;

    if (!target_plan || !MEMBERSHIP_PRICES[target_plan]) {
      return new Response(JSON.stringify({ error: "Invalid target plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer(s)
    const customers = await stripe.customers.list({ email: user.email, limit: 100 });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which subscription to update (studio or broedplaats)
    const isTargetBroedplaats = target_plan.startsWith("broedplaats");
    const targetOrder = isTargetBroedplaats ? BROEDPLAATS_PLAN_ORDER : STUDIO_PLAN_ORDER;

    // Find the matching subscription (same category)
    let subscription: Stripe.Subscription | null = null;
    let currentPlan: string | null = null;

    for (const sub of allActiveSubscriptions) {
      const currentPriceId = sub.items.data[0]?.price?.id;
      const plan = currentPriceId ? PRICE_TO_PLAN[currentPriceId] : null;
      if (!plan) continue;

      const isBroedplaats = plan.startsWith("broedplaats");
      if (isBroedplaats === isTargetBroedplaats) {
        subscription = sub;
        currentPlan = plan;
        break;
      }
    }

    if (!subscription || !currentPlan) {
      return new Response(
        JSON.stringify({ error: "No matching subscription found for this plan category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

    logStep("Found subscription", {
      subscriptionId: subscription.id,
      currentPlan,
      targetPlan: target_plan,
    });

    if (currentPlan === target_plan) {
      return new Response(
        JSON.stringify({ error: "You already have this plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentRank = targetOrder[currentPlan] ?? 0;
    const targetRank = targetOrder[target_plan] ?? 0;
    const isUpgrade = targetRank > currentRank;

    // Determine target interval (keep same interval as current)
    const currentPriceId = subscription.items.data[0].price.id;
    const currentPlanKey = PRICE_TO_PLAN[currentPriceId];
    const currentPrices = MEMBERSHIP_PRICES[currentPlanKey];
    const isYearly = currentPriceId === currentPrices?.yearly;
    const newPriceId = isYearly
      ? MEMBERSHIP_PRICES[target_plan].yearly
      : MEMBERSHIP_PRICES[target_plan].monthly;

    const subscriptionItemId = subscription.items.data[0].id;

    if (isUpgrade) {
      // UPGRADE: Charge full price difference immediately, then switch plan
      logStep("Processing upgrade", { from: currentPlan, to: target_plan });

      // Get both prices to calculate the full difference
      const [currentPrice, newPrice] = await Promise.all([
        stripe.prices.retrieve(currentPriceId),
        stripe.prices.retrieve(newPriceId),
      ]);

      const diffCents = (newPrice.unit_amount || 0) - (currentPrice.unit_amount || 0);
      logStep("Price difference", { 
        currentAmount: currentPrice.unit_amount, 
        newAmount: newPrice.unit_amount, 
        diffCents 
      });

      if (diffCents > 0) {
        // Create a one-time invoice item for the full difference
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: diffCents,
          currency: newPrice.currency || "eur",
          description: `Upgrade ${currentPlan} → ${target_plan}`,
        });

        // Create and pay the invoice immediately
        const invoice = await stripe.invoices.create({
          customer: customerId,
          auto_advance: true,
        });
        const paid = await stripe.invoices.pay(invoice.id);
        logStep("Difference invoice pay attempted", { invoiceId: invoice.id, amount: diffCents, status: paid.status });

        // Only proceed with the upgrade if the top-up actually settled. For
        // async methods (iDEAL) pay() can return open/processing — switching the
        // plan then would grant the higher tier without the charge clearing.
        if (paid.status !== "paid") {
          logStep("Difference not settled — upgrade aborted", { invoiceId: invoice.id, status: paid.status });
          return new Response(
            JSON.stringify({ error: "De bijbetaling is nog niet voltooid. Probeer het later opnieuw of gebruik een andere betaalmethode." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Switch the subscription without proration (already charged the difference)
      const updated = await stripe.subscriptions.update(subscription.id, {
        items: [{ id: subscriptionItemId, price: newPriceId }],
        proration_behavior: "none",
      });

      logStep("Upgrade complete", { subscriptionId: updated.id });

      // Update profile membership
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabaseAdmin
        .from("profiles")
        .update({ membership: target_plan })
        .eq("id", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "upgrade",
          from: currentPlan,
          to: target_plan,
          effective: "immediate",
          amount_charged: diffCents / 100,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // DOWNGRADE: Schedule change at end of billing period
      logStep("Processing downgrade", { from: currentPlan, to: target_plan, proration: "at_period_end" });

      const updated = await stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: "none",
        billing_cycle_anchor: "unchanged",
      });

      // Cancel any existing scheduled changes and create new schedule
      // The subscription will switch to the new price at next renewal
      logStep("Downgrade scheduled", {
        subscriptionId: updated.id,
        effectiveDate: new Date(subscription.current_period_end * 1000).toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          action: "downgrade",
          from: currentPlan,
          to: target_plan,
          effective: "end_of_period",
          effective_date: new Date(subscription.current_period_end * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("[UPDATE-SUBSCRIPTION] ERROR:", error);
    const message = error instanceof Error ? error.message : "An internal error occurred.";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
