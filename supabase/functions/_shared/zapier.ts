// Shared helper to notify Zapier after a confirmed booking.
// The webhook URL is stored as a secret (ZAPIER_BOOKING_WEBHOOK_URL) so it
// can be rotated/changed without a code deploy. If the secret is not set,
// the call is silently skipped so booking flows never break.

export interface ZapierBookingPayload {
  naam: string;
  email: string;
  datum: string;        // YYYY-MM-DD
  tijd: string;         // HH:MM
  studio: string;       // human label, e.g. "Studio 1"
  type: "studio" | "producer" | "cockpit";
  duration_hours?: number;
  source?: string;      // which function fired it (for debugging in Zap)
}

export async function notifyZapierBooking(payload: ZapierBookingPayload): Promise<void> {
  const url = Deno.env.get("ZAPIER_BOOKING_WEBHOOK_URL");
  if (!url) {
    console.log("[ZAPIER] No ZAPIER_BOOKING_WEBHOOK_URL set — skipping");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });
    console.log(`[ZAPIER] Webhook fired (${payload.source ?? payload.type}): ${res.status}`);
  } catch (e) {
    console.error("[ZAPIER] Webhook failed:", e);
  }
}

export const STUDIO_LABELS: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};
