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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, name, email, phone, description, budget, preferred_date } = await req.json();

    const typeLabels: Record<string, string> = {
      photography: "Fotografie / Content Creatie",
      clothing: "Kleding op maat",
      merch: "Merchandise beheer",
      "mix-master": "Mix & Master",
      other: "Anders",
    };

    const typeLabel = typeLabels[type] || type;

    // Escape HTML to prevent injection in admin email
    const esc = (s: unknown): string =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Log only non-PII metadata
    console.log(`[SEND-SERVICE-REQUEST] Received request type=${type} from user=${user.id}`);

    // Build email HTML
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
          <h1 style="color: white; font-size: 22px; margin: 0;">📩 Nieuwe Service Aanvraag</h1>
        </div>
        <div style="background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
          <h2 style="font-size: 18px; margin-top: 0; color: #6366f1;">${esc(typeLabel)}</h2>
          <table style="width: 100%; font-size: 14px; line-height: 1.8; color: #374151;">
            <tr><td style="font-weight: 600; width: 120px;">Naam:</td><td>${name ? esc(name) : "—"}</td></tr>
            <tr><td style="font-weight: 600;">E-mail:</td><td>${email ? esc(email) : "—"}</td></tr>
            <tr><td style="font-weight: 600;">Telefoon:</td><td>${phone ? esc(phone) : "—"}</td></tr>
            ${budget ? `<tr><td style="font-weight: 600;">Budget:</td><td>${esc(budget)}</td></tr>` : ""}
            ${preferred_date ? `<tr><td style="font-weight: 600;">Voorkeursdatum:</td><td>${esc(preferred_date)}</td></tr>` : ""}
          </table>
          ${description ? `<div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 8px;"><p style="font-weight: 600; margin: 0 0 4px; font-size: 14px;">Omschrijving:</p><p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${esc(description)}</p></div>` : ""}
        </div>
        <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 20px;">Uprising Studio App • Automatische melding</p>
      </div>
    `;


    // Send via email queue using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const messageId = `service-request-${crypto.randomUUID()}`;
    await serviceClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: "info@uprisingstudio.nl",
        subject: `Nieuwe aanvraag: ${typeLabel} — ${name || "Onbekend"}`,
        html,
        message_id: messageId,
        purpose: "transactional",
      },
    });

    // Log to email_send_log
    await serviceClient.from("email_send_log").insert({
      message_id: messageId,
      template_name: "service-request",
      recipient_email: "info@uprisingstudio.nl",
      status: "pending",
      metadata: { type, user_id: user.id },
    });

    console.log(`[SEND-SERVICE-REQUEST] Enqueued email ${messageId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[SEND-SERVICE-REQUEST] ERROR:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
