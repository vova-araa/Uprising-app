import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Authenticate user
    const authClient = createClient(supabaseUrl, anonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const userId = userData.user.id;
    const { reason, type } = await req.json();

    // Use service role to bypass RLS trigger
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (type === "broedplaats") {
      const { error } = await adminClient.from("profiles").update({ broedplaats: null }).eq("id", userId);
      if (error) throw error;

      await adminClient.from("admin_audit_logs").insert({
        admin_user_id: userId,
        action: "self_cancel_broedplaats",
        target_id: userId,
        target_table: "profiles",
        details: { reason: reason || "not specified" },
      });
    } else {
      const { error } = await adminClient.from("profiles").update({ membership: null }).eq("id", userId);
      if (error) throw error;

      await adminClient.from("admin_audit_logs").insert({
        admin_user_id: userId,
        action: "self_cancel_membership",
        target_id: userId,
        target_table: "profiles",
        details: { reason: reason || "not specified" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
