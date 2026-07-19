import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth guard: allow service-role calls (cron) or admin/staff users only
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;
    if (!isServiceRole) {
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authClient = createClient(supabaseUrl, anonKey);
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const [adminRes, staffRes] = await Promise.all([
        adminClient.rpc("has_role", { _user_id: userData.user.id, _role: "admin" }),
        adminClient.rpc("has_role", { _user_id: userData.user.id, _role: "staff" }),
      ]);
      if (adminRes.data !== true && staffRes.data !== true) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);


    const now = new Date();

    // Get all past sessions without reports
    const { data: sessions } = await supabase
      .from("org_sessions")
      .select("id, title, session_date, traject_id")
      .lt("session_date", now.toISOString().split("T")[0])
      .order("session_date", { ascending: false });

    const { data: reports } = await supabase
      .from("org_session_reports")
      .select("session_id");

    const reportedIds = new Set((reports || []).map((r: any) => r.session_id));
    const missingSessions = (sessions || []).filter((s: any) => !reportedIds.has(s.id));

    if (missingSessions.length === 0) {
      return new Response(JSON.stringify({ message: "Alle rapporten zijn ingevuld" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin user IDs
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "staff"]);

    const adminIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];

    // Get traject names for context
    const trajectIds = [...new Set(missingSessions.filter((s: any) => s.traject_id).map((s: any) => s.traject_id))];
    const { data: trajecten } = await supabase
      .from("org_trajecten")
      .select("id, title")
      .in("id", trajectIds.length > 0 ? trajectIds : ["__none__"]);

    const trajectMap = new Map((trajecten || []).map((t: any) => [t.id, t.title]));

    // Create notifications for each admin
    const message = `Er ${missingSessions.length === 1 ? "is" : "zijn"} ${missingSessions.length} rapportage${missingSessions.length === 1 ? "" : "s"} die nog ingevuld ${missingSessions.length === 1 ? "moet" : "moeten"} worden.`;

    const notifications = adminIds.map((userId: string) => ({
      user_id: userId,
      title: "📋 Ontbrekende rapportages",
      message,
      type: "warning",
      link: "/#/org",
    }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({
      missing: missingSessions.length,
      notified: adminIds.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
