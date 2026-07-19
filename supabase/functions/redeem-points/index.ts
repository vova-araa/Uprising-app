// Rewards shop: spend points on wallet credit or free studio hours.
// Catalog is config-driven (points_rewards app_config row) with sensible
// defaults; 100 points = EUR 5 as the base exchange rate.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface Reward {
  id: string;
  points: number;
  type: "wallet" | "hours";
  value: number;        // euros for wallet, hours for hours
  studio?: string;      // for hours rewards
  label: string;
}

const DEFAULT_REWARDS: Reward[] = [
  { id: "credit-5", points: 100, type: "wallet", value: 5, label: "€5 studio-tegoed" },
  { id: "credit-10", points: 200, type: "wallet", value: 10, label: "€10 studio-tegoed" },
  { id: "hour-studio2", points: 250, type: "hours", value: 1, studio: "studio-2", label: "1 uur Studio 2" },
  { id: "hour-content", points: 300, type: "hours", value: 1, studio: "content-room", label: "1 uur Content Room" },
  { id: "hour-studio1", points: 400, type: "hours", value: 1, studio: "studio-1", label: "1 uur Studio 1" },
];

const STUDIO_CREDIT_FIELD: Record<string, string> = {
  "studio-1": "studio1_hours",
  "studio-2": "studio2_hours",
  "content-room": "content_hours",
};

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load catalog (config override or defaults)
    const { data: cfg } = await supabaseAdmin
      .from("app_config").select("config_value").eq("config_key", "points_rewards").eq("is_active", true).maybeSingle();
    const catalog: Reward[] = Array.isArray(cfg?.config_value) ? (cfg!.config_value as Reward[]) : DEFAULT_REWARDS;

    const body = await req.json().catch(() => ({}));

    // GET-style call: return the catalog + balance
    if (!body.reward_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("points_balance").eq("id", user.id).single();
      return new Response(JSON.stringify({ catalog, points_balance: profile?.points_balance || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reward = catalog.find((r) => r.id === body.reward_id);
    if (!reward) {
      return new Response(JSON.stringify({ error: "Onbekende beloning" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct points first — points_apply refuses if the balance is too low
    const { error: ptsErr } = await supabaseAdmin.rpc("points_apply", {
      p_user_id: user.id,
      p_points: -reward.points,
      p_type: "redeem",
      p_note: `Ingewisseld: ${reward.label}`,
    });
    if (ptsErr) {
      const insufficient = String(ptsErr.message || "").includes("insufficient");
      return new Response(JSON.stringify({ error: insufficient ? "Niet genoeg punten" : "Er ging iets mis" }), {
        status: insufficient ? 400 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grant the reward; roll the points back if this fails
    let grantError: string | null = null;
    if (reward.type === "wallet") {
      const expiresAt = new Date(Date.now() + 365 * 86_400_000).toISOString();
      const { error } = await supabaseAdmin.rpc("wallet_apply", {
        p_user_id: user.id,
        p_amount: reward.value,
        p_type: "purchase",
        p_note: `Punten ingewisseld: ${reward.label}`,
        p_expires_at: expiresAt,
      });
      if (error) grantError = error.message;
    } else if (reward.type === "hours" && reward.studio) {
      const field = STUDIO_CREDIT_FIELD[reward.studio];
      if (!field) grantError = "unknown studio";
      else {
        const { data: profile } = await supabaseAdmin
          .from("profiles").select(field).eq("id", user.id).single();
        const current = (profile as Record<string, number> | null)?.[field] || 0;
        const { error } = await supabaseAdmin.from("profiles")
          .update({ [field]: current + reward.value, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        if (error) grantError = error.message;
      }
    } else {
      grantError = "invalid reward type";
    }

    if (grantError) {
      console.error("[REDEEM-POINTS] grant failed, rolling back points:", grantError);
      await supabaseAdmin.rpc("points_apply", {
        p_user_id: user.id,
        p_points: reward.points,
        p_type: "admin_adjust",
        p_note: `Terugboeking: inwisselen mislukt (${reward.label})`,
      });
      return new Response(JSON.stringify({ error: "Inwisselen mislukt, je punten zijn teruggezet" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Beloning ingewisseld! 🛍️",
      message: `${reward.label} is toegevoegd aan je account (-${reward.points} punten).`,
      type: "success",
      link: "/account",
    });

    return new Response(JSON.stringify({ success: true, reward: reward.label }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[REDEEM-POINTS] ERROR:", error);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
