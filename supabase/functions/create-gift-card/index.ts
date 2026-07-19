// Buy a gift card: one-off Stripe payment. On success (verify-payment) the
// card is activated and the code emailed to the recipient (or shown to the
// buyer). Amount presets or custom (5-500 EUR).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user?.email) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { amount, recipient_email, message } = await req.json();
    const amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt < 5 || amt > 500) {
      return new Response(JSON.stringify({ error: "Bedrag moet tussen €5 en €500 zijn" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return new Response(JSON.stringify({ error: "Betaling niet geconfigureerd" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Provisional pending gift card (code assigned on payment success)
    const provisional = `PENDING-${crypto.randomUUID()}`;
    const { data: gc, error: insErr } = await admin.from("gift_cards").insert({
      code: provisional, amount: amt, purchaser_user_id: user.id,
      recipient_email: recipient_email || null, message: message ? String(message).slice(0, 500) : null,
      status: "pending",
    }).select("id").single();
    if (insErr || !gc) return new Response(JSON.stringify({ error: "Aanmaken mislukt" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const origin = Deno.env.get("APP_URL") || "https://app.uprisingstudio.nl";
    const session = await stripe.checkout.sessions.create({
      customer: customers.data[0]?.id,
      customer_email: customers.data[0] ? undefined : user.email,
      line_items: [{ price_data: { currency: "eur", product_data: { name: `Uprising Cadeaubon €${amt}` }, unit_amount: amt * 100 }, quantity: 1 }],
      mode: "payment",
      payment_method_types: ["card", "ideal"],
      success_url: `${origin}/account?payment=success&tab=settings&type=gift-card&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/account?payment=cancelled`,
      metadata: { user_id: user.id, type: "gift-card", gift_card_id: gc.id },
    });

    await admin.from("gift_cards").update({ stripe_session_id: session.id }).eq("id", gc.id);
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[CREATE-GIFT-CARD] ERROR:", e);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
