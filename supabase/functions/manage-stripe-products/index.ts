import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.error("Auth error:", userError.message);
      throw new Error("Not authenticated: " + userError.message);
    }
    const user = userData.user;
    if (!user) throw new Error("Not authenticated: no user");

    // Check admin role using service role client to bypass RLS
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: isAdmin, error: adminErr } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isStaff, error: staffErr } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "staff" });
    console.log("Role check:", { userId: user.id, isAdmin, isStaff, adminErr: adminErr?.message, staffErr: staffErr?.message });
    if (!isAdmin && !isStaff) throw new Error("Access denied for user " + user.id);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const reqBody = await req.json();
    const { action, productId, priceId, name, description, amount, active } = reqBody;

    if (action === "list") {
      const products = await stripe.products.list({ limit: 100, active: true });
      const prices = await stripe.prices.list({ limit: 100, active: true });
      
      const enriched = products.data.map((p) => {
        const productPrices = prices.data.filter((pr) => pr.product === p.id);
        return { ...p, prices: productPrices };
      });

      return new Response(JSON.stringify({ products: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_product") {
      const updated = await stripe.products.update(productId, {
        name,
        description: description || undefined,
        active: active !== undefined ? active : undefined,
      });
      return new Response(JSON.stringify({ product: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_price") {
      // Stripe doesn't allow updating price amount, so we deactivate old and create new
      if (amount !== undefined) {
        const oldPrice = await stripe.prices.retrieve(priceId);
        // Create new price with same settings
        const newPriceData: any = {
          product: oldPrice.product as string,
          currency: oldPrice.currency,
          unit_amount: amount,
        };
        if (oldPrice.recurring) {
          newPriceData.recurring = {
            interval: oldPrice.recurring.interval,
            interval_count: oldPrice.recurring.interval_count,
          };
        }
        const newPrice = await stripe.prices.create(newPriceData);
        // Deactivate old price
        await stripe.prices.update(priceId, { active: false });
        // Set as default price on product
        await stripe.products.update(oldPrice.product as string, { default_price: newPrice.id });
        return new Response(JSON.stringify({ price: newPrice }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "add_price") {
      const { product: prodId, amount: priceAmount, currency: priceCurrency, nickname, recurring: recurringInterval } = reqBody;
      const priceData: any = {
        product: prodId,
        currency: priceCurrency || "eur",
        unit_amount: priceAmount,
      };
      if (nickname) priceData.nickname = nickname;
      if (recurringInterval) priceData.recurring = { interval: recurringInterval };
      const newPrice = await stripe.prices.create(priceData);
      return new Response(JSON.stringify({ price: newPrice }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate_price") {
      await stripe.prices.update(priceId, { active: false });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate_product") {
      // Deactivate all active prices first
      const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
      for (const price of prices.data) {
        await stripe.prices.update(price.id, { active: false });
      }
      // Deactivate the product
      await stripe.products.update(productId, { active: false });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[MANAGE-STRIPE-PRODUCTS] ERROR:", msg);
    return new Response(JSON.stringify({ error: "Request failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
