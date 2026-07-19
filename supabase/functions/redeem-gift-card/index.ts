// Redeem a gift card code into the caller's wallet.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_DAYS = 365;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { code } = await req.json();
    if (!code || typeof code !== "string") return new Response(JSON.stringify({ error: "Vul een code in" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const normalized = code.trim().toUpperCase();

    // Atomically claim the card: only flips active -> redeemed once
    const { data: claimed, error: claimErr } = await admin
      .from("gift_cards")
      .update({ status: "redeemed", redeemed_by: user.id, redeemed_at: new Date().toISOString() })
      .eq("code", normalized)
      .eq("status", "active")
      .select("id, amount")
      .maybeSingle();

    if (claimErr) { console.error("[REDEEM-GIFT-CARD] claim error:", claimErr); return new Response(JSON.stringify({ error: "Er ging iets mis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    if (!claimed) {
      // Distinguish unknown vs already-redeemed for a friendlier message
      const { data: existing } = await admin.from("gift_cards").select("status").eq("code", normalized).maybeSingle();
      const msg = !existing ? "Deze code bestaat niet." : existing.status === "redeemed" ? "Deze cadeaubon is al ingewisseld." : existing.status === "pending" ? "Deze cadeaubon is nog niet betaald." : "Deze cadeaubon is niet geldig.";
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const expiresAt = new Date(Date.now() + VALID_DAYS * 86400000).toISOString();
    const { error: walletErr } = await admin.rpc("wallet_apply", {
      p_user_id: user.id, p_amount: Number(claimed.amount), p_type: "purchase",
      p_note: `Cadeaubon ingewisseld (${normalized})`, p_expires_at: expiresAt,
    });
    if (walletErr) {
      // Roll back the claim so the card can be tried again
      await admin.from("gift_cards").update({ status: "active", redeemed_by: null, redeemed_at: null }).eq("id", claimed.id);
      return new Response(JSON.stringify({ error: "Inwisselen mislukt, probeer opnieuw" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("notifications").insert({
      user_id: user.id, title: "Cadeaubon ingewisseld! 🎁",
      message: `€${claimed.amount} tegoed is toegevoegd aan je account (1 jaar geldig).`,
      type: "success", link: "/account",
    });

    return new Response(JSON.stringify({ success: true, amount: claimed.amount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[REDEEM-GIFT-CARD] ERROR:", e);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
