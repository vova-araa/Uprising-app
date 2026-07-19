// Shared Nuki Web API helpers: booking-scoped keypad-code provisioning and
// cleanup. Imported by create-booking, verify-payment, cancel-booking and
// nuki-integration so provisioning happens in-process (no HTTP hop).
//
// Access model (Pirate Studios-style, verified against the Nuki Web API):
// - One 6-digit keypad code per booking (type-13 authorization), valid from
//   15 min before start until 15 min after end, on the room lock AND every
//   lock flagged is_entrance (front door / intercom layer).
// - Auth creation is async on Nuki's side; we name auths "booking:<id>" so
//   cleanup can find them without needing the (unreturned) auth ids.
// - After creating auths we force a sync per lock so codes propagate to the
//   devices well before the session starts.

const NUKI_API_BASE = "https://api.nuki.io";
const TIMEZONE = "Europe/Amsterdam";

export const ACCESS_BUFFER_BEFORE_MIN = 15;
export const ACCESS_BUFFER_AFTER_MIN = 15;

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
 * Nuki keypad code rules: 6 digits, only 1-9 (no zero), must not start
 * with "12" (reserved), unique per device (uniqueness enforced by Nuki).
 */
export function generateKeypadCode(): string {
  const digits = "123456789";
  let code = "";
  do {
    code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map((b) => digits[b % 9])
      .join("");
  } while (code.startsWith("12"));
  return code;
}

export function bookingAuthName(bookingId: string): string {
  // Nuki auth names are limited in length; a booking-id prefix is unique enough
  return `booking:${bookingId.slice(0, 8)}`;
}

async function nukiFetch(path: string, init: RequestInit = {}, timeoutMs = 9000): Promise<Response | null> {
  const headers = nukiHeaders();
  if (!headers) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(`${NUKI_API_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      signal: controller.signal,
    });
  } catch (e) {
    console.error(`[NUKI-SHARED] ${path} failed:`, e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Resolve the locks a booking needs: the room lock + all entrance locks. */
export async function resolveLocksForStudio(
  supabaseAdmin: SupabaseAdminLike,
  studioId: string,
): Promise<{ roomLock: any | null; allLocks: any[] }> {
  const { data: locks } = await supabaseAdmin
    .from("nuki_smartlocks")
    .select("*")
    .eq("is_active", true);

  const active = (locks || []) as any[];
  const roomLock = active.find((l) => l.studio_id === studioId)
    || active.find((l) => l.studio_id === "all-studios")
    || null;
  const entranceLocks = active.filter((l) => l.is_entrance);

  const byId = new Map<string, any>();
  for (const l of [...entranceLocks, ...(roomLock ? [roomLock] : [])]) {
    byId.set(String(l.smartlock_id), l);
  }
  return { roomLock, allLocks: [...byId.values()] };
}

/**
 * Provision booking-scoped access: booking_access record + keypad code on all
 * relevant locks. Safe to call multiple times (upserts; skips code creation
 * when one already exists). Never throws — booking confirmation must not fail
 * on lock trouble; falls back to remote-unlock-only access.
 */
export async function provisionBookingAccess(
  supabaseAdmin: SupabaseAdminLike,
  bookingId: string,
): Promise<{ ok: boolean; keypadCode?: string; reason?: string }> {
  try {
    const { data: booking } = await supabaseAdmin
      .from("bookings").select("*").eq("id", bookingId).single();
    if (!booking || booking.status !== "confirmed") {
      return { ok: false, reason: "booking_not_confirmed" };
    }

    const { roomLock, allLocks } = await resolveLocksForStudio(supabaseAdmin, booking.studio_id);
    if (!roomLock) return { ok: false, reason: "no_lock_for_studio" };

    const [startHour, startMin] = String(booking.start_time).split(":").map(Number);
    const accessStart = buildLocalDate(booking.booking_date, startHour, startMin - ACCESS_BUFFER_BEFORE_MIN);
    const sessionEnd = buildLocalDate(booking.booking_date, startHour + booking.duration_hours, startMin);
    const keypadEnd = new Date(sessionEnd.getTime() + ACCESS_BUFFER_AFTER_MIN * 60 * 1000);

    // Upsert booking_access (unique per booking)
    const { data: existing } = await supabaseAdmin
      .from("booking_access").select("id, keypad_code").eq("booking_id", bookingId).maybeSingle();

    let keypadCode: string | null = existing?.keypad_code || null;
    let accessId: string;

    if (existing) {
      accessId = existing.id;
      await supabaseAdmin.from("booking_access").update({
        access_start: accessStart.toISOString(),
        access_end: sessionEnd.toISOString(),
        smartlock_id: roomLock.smartlock_id,
        access_status: "scheduled",
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      const { data: created, error } = await supabaseAdmin.from("booking_access").insert({
        booking_id: bookingId,
        user_id: booking.user_id,
        studio_id: booking.studio_id,
        smartlock_id: roomLock.smartlock_id,
        access_start: accessStart.toISOString(),
        access_end: sessionEnd.toISOString(),
        access_status: "scheduled",
      }).select("id").single();
      if (error || !created) return { ok: false, reason: `access_insert_failed: ${error?.message}` };
      accessId = created.id;
    }

    // Keypad code via Nuki Web API (best effort — remote unlock keeps working
    // without it)
    if (!keypadCode && nukiHeaders()) {
      keypadCode = generateKeypadCode();
      const res = await nukiFetch("/smartlock/auth", {
        method: "PUT",
        body: JSON.stringify({
          name: bookingAuthName(bookingId),
          type: 13, // keypad code
          code: parseInt(keypadCode, 10),
          smartlockIds: allLocks.map((l) => Number(l.smartlock_id)),
          allowedFromDate: accessStart.toISOString(),
          allowedUntilDate: keypadEnd.toISOString(),
        }),
      });

      if (res && (res.status === 200 || res.status === 204 || res.status === 202)) {
        await supabaseAdmin.from("booking_access").update({
          keypad_code: keypadCode,
          updated_at: new Date().toISOString(),
        }).eq("id", accessId);

        // Force-sync each lock so the code reaches the device ahead of time
        for (const lock of allLocks) {
          await nukiFetch(`/smartlock/${lock.smartlock_id}/sync`, { method: "POST" });
        }
      } else {
        console.error(`[NUKI-SHARED] auth create failed for booking ${bookingId}:`, res?.status, await res?.text().catch(() => ""));
        keypadCode = null;
      }
    }

    return { ok: true, keypadCode: keypadCode || undefined };
  } catch (e) {
    console.error("[NUKI-SHARED] provisionBookingAccess error:", e);
    return { ok: false, reason: String(e) };
  }
}

/**
 * Best-effort removal of the keypad auths belonging to a booking (used on
 * cancellation so a cancelled booking's code stops working immediately).
 */
export async function deleteBookingAuths(bookingId: string): Promise<void> {
  if (!nukiHeaders()) return;
  try {
    const res = await nukiFetch("/smartlock/auth");
    if (!res || !res.ok) return;
    const auths = await res.json().catch(() => []) as any[];
    const name = bookingAuthName(bookingId);
    const ids = (auths || []).filter((a) => a?.name === name).map((a) => a.id).filter(Boolean);
    if (ids.length > 0) {
      await nukiFetch("/smartlock/auth", {
        method: "DELETE",
        body: JSON.stringify(ids),
      });
    }
  } catch (e) {
    console.error("[NUKI-SHARED] deleteBookingAuths error:", e);
  }
}

/**
 * Cleanup for the scheduler: delete expired "booking:*" auths from Nuki so
 * keypads don't fill up (Smart Lock 3.0 keypads cap at 200 codes).
 */
export async function cleanupExpiredAuths(): Promise<number> {
  if (!nukiHeaders()) return 0;
  try {
    const res = await nukiFetch("/smartlock/auth");
    if (!res || !res.ok) return 0;
    const auths = await res.json().catch(() => []) as any[];
    const cutoff = Date.now() - 60 * 60 * 1000; // expired over an hour ago
    const ids = (auths || [])
      .filter((a) => typeof a?.name === "string" && a.name.startsWith("booking:"))
      .filter((a) => a?.allowedUntilDate && new Date(a.allowedUntilDate).getTime() < cutoff)
      .map((a) => a.id)
      .filter(Boolean);
    if (ids.length > 0) {
      await nukiFetch("/smartlock/auth", { method: "DELETE", body: JSON.stringify(ids) });
    }
    return ids.length;
  } catch (e) {
    console.error("[NUKI-SHARED] cleanupExpiredAuths error:", e);
    return 0;
  }
}

/** Remote unlock helper used by the panic flow. */
export async function remoteUnlock(smartlockId: string, action: "unlock" | "open" = "unlock"): Promise<boolean> {
  const path = action === "open"
    ? `/smartlock/${smartlockId}/action`
    : `/smartlock/${smartlockId}/action/unlock`;
  const res = await nukiFetch(path, {
    method: "POST",
    body: action === "open" ? JSON.stringify({ action: 3 }) : undefined,
  });
  return !!res && res.ok;
}
