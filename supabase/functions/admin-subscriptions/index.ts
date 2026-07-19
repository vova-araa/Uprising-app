import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map price IDs to plan names (same as check-subscription)
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

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    const { data: isStaff } = await supabaseAdmin.rpc("has_role", { _user_id: userData.user.id, _role: "staff" });
    if (!isAdmin && !isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const url = new URL(req.url);
    const detailSubId = url.searchParams.get("subscription_id");

    // ── Deep-dive into a single subscription ──
    if (detailSubId) {
      const sub = await stripe.subscriptions.retrieve(detailSubId, {
        expand: ["customer", "items.data.price.product"],
      });
      const customer = sub.customer as any;

      // Fetch all invoices for this subscription
      const invoices: any[] = [];
      let hasMore = true;
      let startingAfter: string | undefined;
      while (hasMore) {
        const params: any = { subscription: detailSubId, limit: 100 };
        if (startingAfter) params.starting_after = startingAfter;
        const result = await stripe.invoices.list(params);
        invoices.push(...result.data);
        hasMore = result.has_more;
        if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
      }

      const priceItem = sub.items.data[0];
      const product = priceItem?.price?.product as any;

      // Build event timeline
      const events: any[] = [];

      // Subscription created
      events.push({
        type: "created",
        date: new Date(sub.created * 1000).toISOString(),
        description: "Abonnement aangemaakt",
      });

      // Each invoice = a payment event
      for (const inv of invoices) {
        events.push({
          type: inv.status === "paid" ? "payment_success" : inv.status === "open" ? "payment_pending" : "payment_failed",
          date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
          description: `Factuur ${inv.number || inv.id}`,
          amount: (inv.amount_paid || inv.total || 0) / 100,
          status: inv.status,
          invoice_url: inv.hosted_invoice_url,
          period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
          period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
        });
      }

      // Sort events by date descending
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return new Response(JSON.stringify({
        subscription: {
          id: sub.id,
          status: sub.status,
          created: new Date(sub.created * 1000).toISOString(),
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        },
        customer: {
          id: customer?.id,
          email: customer?.email,
          name: customer?.name,
        },
        product: {
          id: product?.id,
          name: product?.name,
        },
        price: {
          id: priceItem?.price?.id,
          amount: (priceItem?.price?.unit_amount || 0) / 100,
          interval: priceItem?.price?.recurring?.interval,
        },
        invoices: invoices.map(inv => ({
          id: inv.id,
          number: inv.number,
          amount_paid: (inv.amount_paid || 0) / 100,
          total: (inv.total || 0) / 100,
          status: inv.status,
          created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
          period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
          period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
        })),
        total_paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount_paid || 0), 0) / 100,
        months_paid: invoices.filter(i => i.status === "paid").length,
        events,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── List all subscriptions ──
    const subscriptions: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: any = { status: "active", limit: 100, expand: ["data.customer"] };
      if (startingAfter) params.starting_after = startingAfter;
      const result = await stripe.subscriptions.list(params);
      subscriptions.push(...result.data);
      hasMore = result.has_more;
      if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
    }

    // Also fetch canceled (past_due, etc.) for full picture
    let canceledSubs: any[] = [];
    hasMore = true;
    startingAfter = undefined;
    while (hasMore) {
      const params: any = { status: "canceled", limit: 100, expand: ["data.customer"] };
      if (startingAfter) params.starting_after = startingAfter;
      const result = await stripe.subscriptions.list(params);
      canceledSubs.push(...result.data);
      hasMore = result.has_more;
      if (result.data.length > 0) startingAfter = result.data[result.data.length - 1].id;
    }

    const mapSub = async (sub: any) => {
      const customer = sub.customer as any;
      const priceItem = sub.items.data[0];
      const amount = priceItem?.price?.unit_amount || 0;
      const interval = priceItem?.price?.recurring?.interval || "month";
      const productId = priceItem?.price?.product;

      let productName = "Unknown";
      try {
        if (productId) {
          const product = await stripe.products.retrieve(productId as string);
          productName = product.name;
        }
      } catch {}

      const safeDate = (ts: number | null | undefined) => {
        if (!ts || isNaN(ts)) return null;
        try { return new Date(ts * 1000).toISOString(); } catch { return null; }
      };

      return {
        subscription_id: sub.id,
        email: customer?.email || "Unknown",
        name: customer?.name || customer?.email || "Unknown",
        product_name: productName,
        amount: amount / 100,
        interval,
        status: sub.status,
        subscription_end: safeDate(sub.current_period_end),
        created: safeDate(sub.created),
        current_period_start: safeDate(sub.current_period_start),
        current_period_end: safeDate(sub.current_period_end),
        cancel_at_period_end: sub.cancel_at_period_end,
      };
    };

    const members = await Promise.all(subscriptions.map(mapSub));
    const canceledMembers = await Promise.all(canceledSubs.slice(0, 50).map(mapSub));

    // ── Sync active Stripe subscriptions to profiles ──
    for (const sub of subscriptions) {
      const customer = sub.customer as any;
      const email = customer?.email;
      if (!email) continue;
      const priceId = sub.items?.data?.[0]?.price?.id;
      const plan = priceId ? PRICE_TO_PLAN[priceId] : null;
      if (!plan) continue;

      const isStudioPlan = ["basic", "pro", "unlimited"].includes(plan);
      const isBroedplaatsPlan = plan.startsWith("broedplaats");

      const profileUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
      if (isStudioPlan) profileUpdate.membership = plan;
      if (isBroedplaatsPlan) profileUpdate.broedplaats = plan;

      await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("email", email);
    }

    // Admin-assigned memberships
    const { data: assignedProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, membership, broedplaats")
      .not("membership", "is", null);

    const { data: assignedBroedplaatsProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, membership, broedplaats")
      .not("broedplaats", "is", null);

    const membershipPrices: Record<string, number> = {
      basic: 150, pro: 250, unlimited: 350,
      "broedplaats-students": 45, scholieren: 45, broedplaats: 70, "broedplaats-plus": 150,
    };

    const stripeEmails = new Set(members.map(m => m.email.toLowerCase()));

    const assignedStudioMembers = (assignedProfiles || [])
      .filter(p => p.membership && !stripeEmails.has((p.email || "").toLowerCase()))
      .map(p => ({
        email: p.email || "Unknown",
        name: p.full_name || p.email || "Unknown",
        product_name: `${p.membership!.charAt(0).toUpperCase() + p.membership!.slice(1)} (toegewezen)`,
        amount: membershipPrices[p.membership!] || 0,
        interval: "month" as const,
        status: "admin_assigned",
        subscription_end: null,
        created: null,
        source: "admin" as const,
      }));

    const assignedBroedplaatsMembers = (assignedBroedplaatsProfiles || [])
      .filter(p => p.broedplaats && !stripeEmails.has((p.email || "").toLowerCase()))
      .map(p => ({
        email: p.email || "Unknown",
        name: p.full_name || p.email || "Unknown",
        product_name: `${p.broedplaats!.charAt(0).toUpperCase() + p.broedplaats!.slice(1)} (toegewezen)`,
        amount: membershipPrices[p.broedplaats!] || 0,
        interval: "month" as const,
        status: "admin_assigned",
        subscription_end: null,
        created: null,
        source: "admin" as const,
      }));

    const allMembers = [...members, ...assignedStudioMembers, ...assignedBroedplaatsMembers];

    // Calculate revenue
    const monthlyRevenue = members
      .filter(m => m.status === "active")
      .reduce((s, m) => s + m.amount, 0);

    return new Response(JSON.stringify({
      total: allMembers.length,
      active_count: members.length,
      canceled_count: canceledMembers.length,
      monthly_revenue: monthlyRevenue,
      all_members: allMembers,
      canceled_members: canceledMembers,
      studio_members: allMembers.filter(m =>
        ["basic", "pro", "unlimited"].some(t => m.product_name.toLowerCase().includes(t))
      ),
      broedplaats_members: allMembers.filter(m =>
        ["broedplaats", "scholieren"].some(t => m.product_name.toLowerCase().includes(t))
      ),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
