// Shared Nuki Web API helpers. Imported by create-booking, verify-payment,
// cancel-booking and nuki-integration so provisioning happens in-process.
//
// Access model (matches the physical setup): one Nuki on the FRONT DOOR that
// opens automatically after an in-app unlock — no keypads, no codes. A
// booking gets a time-windowed booking_access record; during that window the
// app's unlock button (nuki-integration ?action=unlock) opens the door.

const NUKI_API_BASE = "https://api.nuki.io";
const TIMEZONE = "Europe/Amsterdam";

export const ACCESS_BUFFER_BEFORE_MIN = 15;

interface SupabaseAdminLike {
  from: (table: string) => any;
}

function nukiHeaders(): Record<string, string> | null {
  const apiKey = Deno.env.get("NUKI_API_KEY");
  if (!apiKey) return null;
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

/** Build a proper UTC Date from a local date string + time in Europe/Amsterdam */
export function buildLocalDate(dateStr: string, hours: number, minutes: number): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  let h = hours;
  let m = minutes;
  while (m < 0) { m += 60; h -= 1; }
  while (m >= 60) { m -= 60; h += 1; }
  const naive = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00`);
  const utcDate = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0");
  const localInTz = new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = localInTz.getTime() - utcDate.getTime();
  return new Date(naive.getTime() - offsetMs);
}

/**
 * Resolve the lock(s) relevant for a studio. With the single front-door
 * setup this returns the entrance lock; the per-studio/all-studios fallbacks
 * keep older data working.
 */
export async function resolveLocksForStudio(
  supabaseAdmin: SupabaseAdminLike,
  studioId: string,
): Promise<{ roomLock: any | null; allLocks: any[] }> {
  const { data: locks } = await supabaseAdmin
    .from("nuki_smartlocks")
    .select("*")
    .eq("is_active", true);

  const active = (locks || []) as any[];
  const entrance = active.find((l) => l.is_entrance);
  const roomLock = entrance
    || active.find((l) => l.studio_id === studioId)
    || active.find((l) => l.studio_id === "all-studios")
    || null;

  const byId = new Map<string, any>();
  for (const l of active.filter((x) => x.is_entrance)) byId.set(String(l.smartlock_id), l);
  if (roomLock) byId.set(String(roomLock.smartlock_id), roomLock);
  return { roomLock, allLocks: [...byId.values()] };
}

/**
 * Provision booking-scoped access: a time-windowed booking_access record for
 * the front-door lock. The app's unlock button works during this window.
 * Safe to call multiple times; never throws — booking confirmation must not
 * fail on lock trouble.
 */
export async function provisionBookingAccess(
  supabaseAdmin: SupabaseAdminLike,
  bookingId: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { data: booking } = await supabaseAdmin
      .from("bookings").select("*").eq("id", bookingId).single();
    if (!booking || booking.status !== "confirmed") {
      return { ok: false, reason: "booking_not_confirmed" };
    }

    const { roomLock } = await resolveLocksForStudio(supabaseAdmin, booking.studio_id);
    if (!roomLock) return { ok: false, reason: "no_lock_configured" };

    const [startHour, startMin] = String(booking.start_time).split(":").map(Number);
    const accessStart = buildLocalDate(booking.booking_date, startHour, startMin - ACCESS_BUFFER_BEFORE_MIN);
    const sessionEnd = buildLocalDate(booking.booking_date, startHour + booking.duration_hours, startMin);

    const { data: existing } = await supabaseAdmin
      .from("booking_access").select("id").eq("booking_id", bookingId).maybeSingle();

    if (existing) {
      await supabaseAdmin.from("booking_access").update({
        access_start: accessStart.toISOString(),
        access_end: sessionEnd.toISOString(),
        smartlock_id: roomLock.smartlock_id,
        access_status: "scheduled",
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      const { error } = await supabaseAdmin.from("booking_access").insert({
        booking_id: bookingId,
        user_id: booking.user_id,
        studio_id: booking.studio_id,
        smartlock_id: roomLock.smartlock_id,
        access_start: accessStart.toISOString(),
        access_end: sessionEnd.toISOString(),
        access_status: "scheduled",
      });
      if (error) return { ok: false, reason: `access_insert_failed: ${error.message}` };
    }

    return { ok: true };
  } catch (e) {
    console.error("[NUKI-SHARED] provisionBookingAccess error:", e);
    return { ok: false, reason: String(e) };
  }
}

/** Remote unlock/open used by the unlock flow and the panic fallback. */
export async function remoteUnlock(smartlockId: string, action: "unlock" | "open" = "unlock"): Promise<boolean> {
  const headers = nukiHeaders();
  if (!headers) return false;
  const path = action === "open"
    ? `/smartlock/${smartlockId}/action`
    : `/smartlock/${smartlockId}/action/unlock`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), 9000);
  try {
    const res = await fetch(`${NUKI_API_BASE}${path}`, {
      method: "POST",
      headers,
      body: action === "open" ? JSON.stringify({ action: 3 }) : undefined,
      signal: controller.signal,
    });
    return res.ok;
  } catch (e) {
    console.error(`[NUKI-SHARED] remoteUnlock failed:`, e);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
