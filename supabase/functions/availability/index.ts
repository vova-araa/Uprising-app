import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { assertApiKey, corsHeaders, json, isValidDate, ALLOWED_STUDIOS } from "../_shared/cockpit-auth.ts";

// 24/7 self-service: every hour is bookable
const OPEN_HOUR = 0;
const CLOSE_HOUR = 24; // exclusive upper bound for slot starts

const PART_OF_DAY: Record<string, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 18],
  evening: [18, 24],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauth = assertApiKey(req);
  if (unauth) return unauth;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { date, studio_id, part_of_day } = body ?? {};
  if (!isValidDate(date)) return json({ error: "invalid_date" }, 400);
  if (studio_id !== undefined && studio_id !== null && !ALLOWED_STUDIOS.has(studio_id)) {
    return json({ error: "invalid_studio" }, 400);
  }
  if (part_of_day !== undefined && part_of_day !== null && !PART_OF_DAY[part_of_day]) {
    return json({ error: "invalid_part_of_day" }, 400);
  }

  const studios = studio_id ? [studio_id] : Array.from(ALLOWED_STUDIOS);
  const [rangeStart, rangeEnd] = part_of_day ? PART_OF_DAY[part_of_day] : [OPEN_HOUR, CLOSE_HOUR];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const { data: booked, error } = await supabase.rpc("get_booking_availability", {
      target_date: date,
      target_studio_id: studio_id ?? null,
    });
    if (error) return json({ error: error.message }, 500);

    // Group booked blocks by studio
    const busy: Record<string, Array<[number, number]>> = {};
    for (const s of studios) busy[s] = [];
    for (const b of booked ?? []) {
      const [h, m] = String(b.start_time).split(":").map(Number);
      const start = h * 60 + (m || 0);
      const end = start + (b.duration_hours || 0) * 60;
      if (!busy[b.studio_id]) busy[b.studio_id] = [];
      busy[b.studio_id].push([start, end]);
    }

    const slots: Array<{ studio_id: string; start_time: string; available: true }> = [];
    for (const s of studios) {
      for (let h = rangeStart; h < rangeEnd; h++) {
        const slotStart = h * 60;
        const slotEnd = slotStart + 60;
        const overlap = busy[s].some(([bs, be]) => slotStart < be && slotEnd > bs);
        if (!overlap) {
          slots.push({ studio_id: s, start_time: `${String(h).padStart(2, "0")}:00`, available: true });
        }
      }
    }

    return json({ date, slots });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
