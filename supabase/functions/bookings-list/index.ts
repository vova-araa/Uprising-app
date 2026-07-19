import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { assertApiKey, corsHeaders, json, isValidDate, assertTableAllowed } from "../_shared/cockpit-auth.ts";

const ALLOW_LIST = ["bookings", "profiles"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauth = assertApiKey(req);
  if (unauth) return unauth;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const { from, to, customer_name } = body ?? {};
  let limit = Number(body?.limit ?? 100);
  if (!Number.isFinite(limit) || limit <= 0) limit = 100;
  if (limit > 200) limit = 200;

  if (from !== undefined && from !== null && !isValidDate(from)) return json({ error: "invalid_from" }, 400);
  if (to !== undefined && to !== null && !isValidDate(to)) return json({ error: "invalid_to" }, 400);
  if (customer_name !== undefined && customer_name !== null && typeof customer_name !== "string") {
    return json({ error: "invalid_customer_name" }, 400);
  }

  // Enforce allow-list defensively
  const tableCheck = assertTableAllowed("bookings", ALLOW_LIST);
  if (tableCheck) return tableCheck;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Optional: resolve customer name filter to user_ids first
    let userIdFilter: string[] | null = null;
    if (customer_name && customer_name.trim()) {
      const nameCheck = assertTableAllowed("profiles", ALLOW_LIST);
      if (nameCheck) return nameCheck;
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${customer_name.trim()}%`)
        .limit(50);
      if (pErr) return json({ error: pErr.message }, 500);
      userIdFilter = (profs ?? []).map((p: any) => p.id);
      if (userIdFilter.length === 0) return json({ rows: [] });
    }

    let q = supabase
      .from("bookings")
      .select("booking_date, start_time, duration_hours, studio_id, session_type, status, user_id")
      .in("status", ["confirmed", "pending", "pending_payment"])
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(limit);

    if (from) q = q.gte("booking_date", from);
    if (to) q = q.lte("booking_date", to);
    if (userIdFilter) q = q.in("user_id", userIdFilter);

    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);

    // Resolve names for returned bookings
    const ids = Array.from(new Set((data ?? []).map((b: any) => b.user_id).filter(Boolean)));
    const nameMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of profs ?? []) nameMap.set(p.id, p.full_name ?? "");
    }

    const rows = (data ?? []).map((b: any) => ({
      booking_date: b.booking_date,
      start_time: b.start_time,
      duration_hours: b.duration_hours,
      customer_name: nameMap.get(b.user_id) || "Onbekend",
      studio_id: b.studio_id,
      session_type: b.session_type,
      status: b.status,
    }));

    return json({ rows });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
