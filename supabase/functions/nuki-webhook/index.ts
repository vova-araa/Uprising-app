// Receiver for Nuki decentral webhooks (DEVICE_LOGS, DEVICE_STATUS,
// DEVICE_AUTHS). Registered via PUT https://api.nuki.io/api/decentralWebhook
// with this function's URL. Events are stored for the admin panel, and door
// unlocks during a booking window double as the customer's check-in.
//
// Security: when NUKI_WEBHOOK_SECRET is set, the HMAC-SHA256 signature that
// Nuki sends along is verified against the raw body; unsigned/invalid
// requests are rejected. verify_jwt is disabled for this function in
// supabase/config.toml because Nuki can't send a Supabase JWT.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Nuki log actions that count as an entry (unlock/unlatch)
const ENTRY_ACTIONS = new Set([1, 3]); // 1 = unlock, 3 = unlatch

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  const secret = Deno.env.get("NUKI_WEBHOOK_SECRET");
  if (secret) {
    const signature = req.headers.get("x-nuki-signature-sha256")
      || req.headers.get("x-nuki-signature")
      || "";
    const expected = await hmacHex(secret, rawBody);
    if (!timingSafeEqual(signature.toLowerCase(), expected)) {
      return new Response("invalid signature", { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const feature = payload?.feature || null;
  const smartlockId = payload?.smartlockId != null ? String(payload.smartlockId)
    : payload?.smartlockLog?.smartlockId != null ? String(payload.smartlockLog.smartlockId)
    : null;

  await supabaseAdmin.from("nuki_events").insert({
    smartlock_id: smartlockId,
    feature,
    event_type: payload?.smartlockLog?.action != null ? `log_action_${payload.smartlockLog.action}` : feature,
    payload,
  });

  // Door unlock during a booking window = check-in
  if (feature === "DEVICE_LOGS" && smartlockId && payload?.smartlockLog) {
    const log = payload.smartlockLog;
    if (ENTRY_ACTIONS.has(Number(log.action))) {
      const eventTime = log.date ? new Date(log.date) : new Date();
      const { data: accessRecords } = await supabaseAdmin
        .from("booking_access")
        .select("id, checked_in_at, access_start, access_end")
        .eq("smartlock_id", smartlockId)
        .in("access_status", ["scheduled", "active"])
        .lte("access_start", eventTime.toISOString())
        .gte("access_end", eventTime.toISOString());

      for (const access of accessRecords || []) {
        if (!access.checked_in_at) {
          await supabaseAdmin.from("booking_access").update({
            checked_in_at: eventTime.toISOString(),
            access_status: "active",
            updated_at: new Date().toISOString(),
          }).eq("id", access.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
