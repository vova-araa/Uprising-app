export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/**
 * Returns null if authorized, or a Response (401) if not.
 */
export function assertApiKey(req: Request): Response | null {
  const provided = req.headers.get("x-api-key") ?? "";
  const expected = Deno.env.get("EXPORT_API_KEY") ?? "";
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

export const ALLOWED_STUDIOS = new Set(["studio-1", "studio-2", "content-room"]);

export const STUDIO_DISPLAY_NAME: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};

export function assertTableAllowed(table: string, allowList: string[]): Response | null {
  if (!allowList.includes(table)) {
    return json({ error: "forbidden_table", table }, 403);
  }
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && DATE_RE.test(s) && !isNaN(Date.parse(s));
}

export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && TIME_RE.test(s);
}
