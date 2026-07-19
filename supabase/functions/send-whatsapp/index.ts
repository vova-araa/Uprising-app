// Send a WhatsApp message from Uprising's own WhatsApp Business number via the
// Meta Cloud API. Business-initiated messages require an approved template, so
// this sends TEMPLATE messages (name + language + body params). It no-ops
// gracefully when the integration isn't configured yet.
//
// Required env once set up in Meta Business:
//   WHATSAPP_PHONE_NUMBER_ID  — the Cloud API phone number id
//   WHATSAPP_ACCESS_TOKEN     — a permanent system-user token
//
// Call auth: service role (scheduler) or admin/staff (manual/test).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_VERSION = "v21.0";

function toE164(raw: string): string | null {
  const trimmed = String(raw || "").replace(/[^\d+]/g, "");
  if (!trimmed) return null;
  // Assume NL when no country code is present
  if (trimmed.startsWith("+")) return trimmed.slice(1);
  if (trimmed.startsWith("00")) return trimmed.slice(2);
  if (trimmed.startsWith("0")) return "31" + trimmed.slice(1);
  return trimmed;
}

export async function sendWhatsAppTemplate(to: string, template: string, lang: string, params: string[]): Promise<{ ok: boolean; reason?: string }> {
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!phoneId || !token) return { ok: false, reason: "not_configured" };
  const num = toE164(to);
  if (!num) return { ok: false, reason: "invalid_number" };

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: num,
    type: "template",
    template: {
      name: template,
      language: { code: lang || "nl" },
      ...(params.length > 0 ? { components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p).slice(0, 300) })) }] } : {}),
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[WHATSAPP] send failed:", res.status, txt.slice(0, 300));
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[WHATSAPP] error:", e);
    return { ok: false, reason: "network" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!isServiceRole) {
      const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error } = await supabaseUser.auth.getUser(token);
      if (error || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const { data: isStaff } = await admin.rpc("has_role", { _user_id: user.id, _role: "staff" });
      if (isAdmin !== true && isStaff !== true) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { to, template, lang, params } = await req.json();
    if (!to || !template) return new Response(JSON.stringify({ error: "to en template vereist" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const result = await sendWhatsAppTemplate(to, template, lang || "nl", Array.isArray(params) ? params : []);
    return new Response(JSON.stringify(result), { status: result.ok ? 200 : 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[SEND-WHATSAPP] ERROR:", e);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
