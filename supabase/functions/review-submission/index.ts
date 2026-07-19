// Admin review of media submissions (session videos / clean-room photos).
// Approval awards points and, for videos, confirms Uprising may use the
// content for its socials (consent was given at upload).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Defaults; overridable via the points_config app_config row
const DEFAULT_POINTS: Record<string, number> = {
  session_video: 50,
  clean_room_photo: 20,
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

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isStaff } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "staff" });
    if (isAdmin !== true && isStaff !== true) {
      return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id, action, note } = await req.json();
    if (!submission_id || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "submission_id en action (approve/reject) vereist" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: submission } = await supabaseAdmin
      .from("media_submissions").select("*").eq("id", submission_id).single();
    if (!submission) {
      return new Response(JSON.stringify({ error: "Inzending niet gevonden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (submission.status !== "pending") {
      return new Response(JSON.stringify({ error: "Inzending is al beoordeeld" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pointsAwarded = 0;
    if (action === "approve") {
      const { data: cfg } = await supabaseAdmin
        .from("app_config").select("config_value").eq("config_key", "points_config").eq("is_active", true).maybeSingle();
      const configPoints = (cfg?.config_value as Record<string, number>) || {};
      pointsAwarded = Number(configPoints[submission.kind] ?? DEFAULT_POINTS[submission.kind] ?? 0);

      if (pointsAwarded > 0) {
        const { error: ptsErr } = await supabaseAdmin.rpc("points_apply", {
          p_user_id: submission.user_id,
          p_points: pointsAwarded,
          p_type: submission.kind === "session_video" ? "video_upload" : "clean_room",
          p_reference_id: submission.id,
          p_note: submission.kind === "session_video" ? "Sessievideo goedgekeurd" : "Schone ruimte foto goedgekeurd",
        });
        if (ptsErr) {
          console.error("[REVIEW-SUBMISSION] points_apply failed:", ptsErr);
          pointsAwarded = 0;
        }
      }
    }

    await supabaseAdmin.from("media_submissions").update({
      status: action === "approve" ? "approved" : "rejected",
      points_awarded: pointsAwarded,
      review_note: typeof note === "string" ? note.slice(0, 500) : null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", submission_id);

    await supabaseAdmin.from("notifications").insert({
      user_id: submission.user_id,
      title: action === "approve" ? `+${pointsAwarded} punten! 🎉` : "Inzending niet goedgekeurd",
      message: action === "approve"
        ? (submission.kind === "session_video"
          ? `Je sessievideo is goedgekeurd — je hebt ${pointsAwarded} punten verdiend. Dankjewel, we gaan 'm gebruiken!`
          : `Je schone-ruimte-foto is goedgekeurd — ${pointsAwarded} punten verdiend. Legend!`)
        : `Je inzending is helaas afgekeurd.${note ? ` Reden: ${String(note).slice(0, 200)}` : ""}`,
      type: action === "approve" ? "success" : "info",
      link: "/account",
    });

    return new Response(JSON.stringify({ success: true, points_awarded: pointsAwarded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[REVIEW-SUBMISSION] ERROR:", error);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
