import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  assertApiKey, corsHeaders, json,
  isValidDate, isValidTime, ALLOWED_STUDIOS, STUDIO_DISPLAY_NAME,
} from "../_shared/cockpit-auth.ts";
import { notifyZapierBooking } from "../_shared/zapier.ts";

const VALID_DURATIONS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const TIMEZONE = "Europe/Amsterdam";

async function checkAvailability(
  supabase: any, studio_id: string, booking_date: string, start_time: string, duration_hours: number,
): Promise<boolean> {
  const [h, m] = start_time.split(":").map(Number);
  const reqStart = h * 60 + (m || 0);
  const reqEnd = reqStart + duration_hours * 60;
  const { data } = await supabase.from("bookings")
    .select("start_time, duration_hours")
    .eq("studio_id", studio_id)
    .eq("booking_date", booking_date)
    .in("status", ["confirmed", "pending_payment", "pending"]);
  for (const b of data ?? []) {
    const [bh, bm] = String(b.start_time).split(":").map(Number);
    const bStart = bh * 60 + (bm || 0);
    const bEnd = bStart + (b.duration_hours || 0) * 60;
    if (reqStart < bEnd && reqEnd > bStart) return false;
  }
  return true;
}

async function resolveCustomer(supabase: any, customer: any): Promise<{ id: string; name: string; email: string; membership: string | null } | { error: string; status: number }> {
  if (!customer || (typeof customer !== "object")) return { error: "customer_required", status: 400 };
  if (customer.id) {
    if (typeof customer.id !== "string") return { error: "invalid_customer_id", status: 400 };
    const { data, error } = await supabase.from("profiles").select("id, full_name, email, membership").eq("id", customer.id).maybeSingle();
    if (error) return { error: error.message, status: 500 };
    if (!data) return { error: "customer_not_found", status: 404 };
    return { id: data.id, name: data.full_name ?? "Onbekend", email: data.email ?? "", membership: data.membership };
  }
  if (customer.name && typeof customer.name === "string") {
    const { data, error } = await supabase.from("profiles").select("id, full_name, email, membership").ilike("full_name", customer.name.trim()).limit(2);
    if (error) return { error: error.message, status: 500 };
    if (!data || data.length === 0) return { error: "customer_not_found", status: 404 };
    if (data.length > 1) return { error: "customer_ambiguous", status: 409 };
    return { id: data[0].id, name: data[0].full_name ?? "Onbekend", email: data[0].email ?? "", membership: data[0].membership };
  }
  return { error: "customer_id_or_name_required", status: 400 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauth = assertApiKey(req);
  if (unauth) return unauth;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { customer, studio_id, booking_date, start_time, duration_hours } = body ?? {};

  if (!studio_id || !ALLOWED_STUDIOS.has(studio_id)) return json({ error: "invalid_studio" }, 400);
  if (!Number.isInteger(duration_hours) || !VALID_DURATIONS.has(duration_hours)) return json({ error: "invalid_duration" }, 400);
  if (!isValidDate(booking_date)) return json({ error: "invalid_date" }, 400);
  if (!isValidTime(start_time)) return json({ error: "invalid_time" }, 400);

  // Not in the past (Amsterdam time)
  const nowAms = new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
  const todayStr = `${nowAms.getFullYear()}-${String(nowAms.getMonth() + 1).padStart(2, "0")}-${String(nowAms.getDate()).padStart(2, "0")}`;
  if (booking_date < todayStr) return json({ error: "date_in_past" }, 400);
  if (booking_date === todayStr) {
    const [bh, bm] = start_time.split(":").map(Number);
    if (bh < nowAms.getHours() || (bh === nowAms.getHours() && bm <= nowAms.getMinutes())) {
      return json({ error: "time_in_past" }, 400);
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const resolved = await resolveCustomer(supabase, customer);
    if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

    // Rooms with an active block (fault report / maintenance) are not bookable
    const { data: blocks } = await supabase
      .from("room_blocks")
      .select("blocked_until")
      .eq("studio_id", studio_id)
      .eq("active", true);
    const blocked = (blocks ?? []).some((b: any) => !b.blocked_until || new Date(b.blocked_until) > new Date());
    if (blocked) return json({ error: "room_blocked" }, 409);

    const available = await checkAvailability(supabase, studio_id, booking_date, start_time, duration_hours);
    if (!available) return json({ error: "slot_unavailable" }, 409);

    const isMember = !!resolved.membership;
    const sessionType = isMember ? "member" : "single";

    const { data: booking, error: insErr } = await supabase.from("bookings").insert({
      user_id: resolved.id,
      studio_id,
      booking_date,
      start_time,
      duration_hours,
      session_type: sessionType,
      extras: [],
      total_price: 0,
      status: "confirmed",
      notes: "Aangemaakt via cockpit-assistent",
    }).select("id").single();

    if (insErr) {
      // 23P01 = bookings_no_overlap exclusion constraint: slot taken concurrently
      if ((insErr as { code?: string }).code === "23P01") return json({ error: "slot_unavailable" }, 409);
      return json({ error: insErr.message }, 500);
    }

    // Notify user
    await supabase.from("notifications").insert({
      user_id: resolved.id,
      title: "Boeking bevestigd!",
      message: `Je ${STUDIO_DISPLAY_NAME[studio_id]} sessie op ${booking_date} om ${start_time} is bevestigd.`,
      type: "success",
      link: "/account?tab=bookings",
    });

    // Notify admins/staff
    const { data: adminRoles } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
    if (adminRoles && adminRoles.length > 0) {
      await supabase.from("notifications").insert(adminRoles.map((r: any) => ({
        user_id: r.user_id,
        title: "Nieuwe boeking (cockpit)",
        message: `${resolved.name} • ${STUDIO_DISPLAY_NAME[studio_id]} op ${booking_date} om ${start_time} (${duration_hours}u)`,
        type: "info",
        link: "/admin?tab=calendar",
      })));
    }

    await notifyZapierBooking({
      naam: resolved.name,
      email: resolved.email,
      datum: booking_date,
      tijd: start_time,
      studio: STUDIO_DISPLAY_NAME[studio_id] || studio_id,
      type: "cockpit",
      duration_hours,
      source: "booking-create",
    });


    return json({
      booking_id: booking.id,
      booking_date, start_time, duration_hours, studio_id,
      customer_name: resolved.name,
      status: "confirmed",
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
