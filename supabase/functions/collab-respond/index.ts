// Respond to a collab post: notifies the post owner that someone is
// interested (with the responder's name), so they can connect. Contact
// details the poster shared are shown directly on the post in the app.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    if (authErr || !user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { post_id, message } = await req.json();
    if (!post_id) return new Response(JSON.stringify({ error: "post_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: post } = await admin.from("collab_posts").select("id, user_id, title, status").eq("id", post_id).maybeSingle();
    if (!post || post.status !== "open") return new Response(JSON.stringify({ error: "Post niet gevonden of gesloten" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (post.user_id === user.id) return new Response(JSON.stringify({ error: "Je kunt niet op je eigen post reageren" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: responder } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
    const who = responder?.full_name || responder?.email || "Iemand";

    await admin.from("notifications").insert({
      user_id: post.user_id,
      title: "Reactie op je collab-post 🤝",
      message: `${who} is geïnteresseerd in "${post.title}".${message ? ` Bericht: ${String(message).slice(0, 200)}` : ""}`,
      type: "info",
      link: "/collab",
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[COLLAB-RESPOND] ERROR:", e);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
