// Two-sided referral: a new user redeems a friend's code within 30 days of
// signup; both sides receive EUR 10 wallet credit (valid 90 days).
// Abuse guards: one redemption per account, can't redeem your own code,
// account must be recent, rewards go through the audited wallet ledger.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REWARD_EUR = 10;
const REWARD_VALID_DAYS = 90;
const MAX_ACCOUNT_AGE_DAYS = 30;

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

    const { code } = await req.json();
    if (!code || typeof code !== "string" || !code.trim()) {
      return new Response(JSON.stringify({ error: "Vul een code in" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Account must be recent (this is a new-user reward)
    const accountAgeDays = (Date.now() - new Date(user.created_at).getTime()) / 86_400_000;
    if (accountAgeDays > MAX_ACCOUNT_AGE_DAYS) {
      return new Response(JSON.stringify({ error: "Referral codes kunnen alleen binnen 30 dagen na aanmelding worden gebruikt." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // One redemption per account
    const { data: existing } = await supabaseAdmin
      .from("referrals").select("id").eq("referred_id", user.id).limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Je hebt al een referral code gebruikt." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the code's owner
    const normalized = code.trim().toUpperCase();
    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("referral_code", normalized)
      .maybeSingle();

    if (!referrer) {
      return new Response(JSON.stringify({ error: "Deze code bestaat niet." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (referrer.id === user.id) {
      return new Response(JSON.stringify({ error: "Je kunt je eigen code niet gebruiken." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: refErr } = await supabaseAdmin.from("referrals").insert({
      referral_code: normalized,
      referrer_id: referrer.id,
      referred_id: user.id,
      status: "completed",
    });
    if (refErr) {
      console.error("[REDEEM-REFERRAL] insert failed:", refErr);
      return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + REWARD_VALID_DAYS * 86_400_000).toISOString();

    await supabaseAdmin.rpc("wallet_apply", {
      p_user_id: user.id,
      p_amount: REWARD_EUR,
      p_type: "referral",
      p_note: `Welkomstegoed via referral ${normalized}`,
      p_expires_at: expiresAt,
    });
    await supabaseAdmin.rpc("wallet_apply", {
      p_user_id: referrer.id,
      p_amount: REWARD_EUR,
      p_type: "referral",
      p_note: "Referral beloning: vriend aangemeld",
      p_expires_at: expiresAt,
    });

    await supabaseAdmin.from("notifications").insert([
      {
        user_id: user.id,
        title: "Welkomstegoed! 🎁",
        message: `Je hebt €${REWARD_EUR} tegoed ontvangen via de code van ${referrer.full_name || "je vriend"}. Geldig 90 dagen.`,
        type: "success",
        link: "/account",
      },
      {
        user_id: referrer.id,
        title: "Referral beloning! 🎉",
        message: `Iemand heeft jouw code gebruikt — je hebt €${REWARD_EUR} tegoed ontvangen. Geldig 90 dagen.`,
        type: "success",
        link: "/account",
      },
    ]);

    return new Response(JSON.stringify({ success: true, reward: REWARD_EUR }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[REDEEM-REFERRAL] ERROR:", error);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
