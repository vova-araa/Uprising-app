import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Admin access required");

    const { subject, body, recipients } = await req.json();
    if (!subject || !body || !recipients?.length) {
      throw new Error("Missing subject, body, or recipients");
    }

    // Fetch notification preferences to filter out users who disabled promotions/email
    const { data: profilesData } = await serviceClient
      .from("profiles")
      .select("email, notification_prefs");
    const prefsMap: Record<string, any> = {};
    for (const p of profilesData || []) {
      if (p.email) prefsMap[p.email] = p.notification_prefs || {};
    }

    // Enqueue each email via the transactional email queue
    let enqueued = 0;
    let skipped = 0;
    for (const r of recipients) {
      // Skip if user disabled email or promotions
      const prefs = prefsMap[r.email] || {};
      if (prefs.email === false || prefs.promotions === false) {
        skipped++;
        continue;
      }
      const esc = (s: string) => String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      const personalizedBody = body.replace(/\{\{naam\}\}/g, r.name || "");
      const messageId = `blast-${crypto.randomUUID()}`;

      await serviceClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: r.email,
          subject,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
              <h1 style="color: white; font-size: 22px; margin: 0;">Uprising Studio</h1>
            </div>
            <div style="background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
              <h2 style="font-size: 18px; margin-top: 0;">${esc(subject)}</h2>
              <div style="font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${esc(personalizedBody)}</div>
            </div>
            <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 20px;">
              Uprising Studio • uprisingstudio.nl
            </p>
          </div>`,
          message_id: messageId,
          purpose: "transactional",
        },
      });
      enqueued++;
    }

    // Log to audit
    await serviceClient.from("admin_audit_logs").insert({
      admin_user_id: user.id,
      action: "blast_email_sent",
      details: { subject, recipient_count: enqueued },
    });

    return new Response(JSON.stringify({ success: true, enqueued, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Blast email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
