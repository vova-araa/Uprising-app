import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { assertApiKey, corsHeaders, json } from "../_shared/cockpit-auth.ts";

async function resolveCustomer(supabase: any, customer: any) {
  if (!customer || typeof customer !== "object") return { error: "customer_required", status: 400 };
  if (customer.id) {
    if (typeof customer.id !== "string") return { error: "invalid_customer_id", status: 400 };
    const { data, error } = await supabase.from("profiles").select("id, full_name").eq("id", customer.id).maybeSingle();
    if (error) return { error: error.message, status: 500 };
    if (!data) return { error: "customer_not_found", status: 404 };
    return { id: data.id, name: data.full_name ?? "Onbekend" };
  }
  if (customer.name && typeof customer.name === "string") {
    const { data, error } = await supabase.from("profiles").select("id, full_name").ilike("full_name", customer.name.trim()).limit(2);
    if (error) return { error: error.message, status: 500 };
    if (!data || data.length === 0) return { error: "customer_not_found", status: 404 };
    if (data.length > 1) return { error: "customer_ambiguous", status: 409 };
    return { id: data[0].id, name: data[0].full_name ?? "Onbekend" };
  }
  return { error: "customer_id_or_name_required", status: 400 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauth = assertApiKey(req);
  if (unauth) return unauth;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const resolved = await resolveCustomer(supabase, body?.customer);
    if ("error" in resolved) return json({ error: resolved.error }, resolved.status);

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from("bookings")
      .select("booking_date")
      .eq("user_id", resolved.id)
      .eq("status", "confirmed")
      .lte("booking_date", today);
    if (error) return json({ error: error.message }, 500);

    const rows = data ?? [];
    const visit_count = rows.length;
    let last_visit: string | null = null;
    for (const r of rows) {
      if (!last_visit || r.booking_date > last_visit) last_visit = r.booking_date;
    }

    return json({ customer_name: resolved.name, last_visit, visit_count });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
