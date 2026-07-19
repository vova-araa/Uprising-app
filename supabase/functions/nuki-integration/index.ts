import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { provisionBookingAccess, remoteUnlock, resolveLocksForStudio } from "../_shared/nuki.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NUKI_API_BASE = "https://api.nuki.io";
const TIMEZONE = "Europe/Amsterdam";

/** Build a proper UTC Date from a local date string + time, accounting for Europe/Amsterdam timezone */
function buildLocalDate(dateStr: string, hours: number, minutes: number): Date {
  // Create a date string in the target timezone and let the engine parse it
  // dateStr = "YYYY-MM-DD"
  const pad = (n: number) => String(n).padStart(2, "0");
  // Handle minute overflow/underflow
  let h = hours;
  let m = minutes;
  while (m < 0) { m += 60; h -= 1; }
  while (m >= 60) { m -= 60; h += 1; }
  // Build an ISO-like string and use Intl to figure out the offset
  const naive = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00`);
  // Get the UTC offset for this date in Europe/Amsterdam
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  // Find offset by comparing UTC interpretation vs local interpretation
  const utcDate = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00Z`);
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0");
  const localInTz = new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = localInTz.getTime() - utcDate.getTime();
  // Now create the correct UTC time: naive local time minus offset
  return new Date(naive.getTime() - offsetMs);
}

// --- Helpers ---

type DebugStatus =
  | "success"
  | "nuki_device_offline"
  | "invalid_token"
  | "forbidden_scope"
  | "invalid_smartlock_id"
  | "duplicate_unlock_request"
  | "access_window_invalid"
  | "booking_invalid"
  | "payment_status_invalid"
  | "timeout"
  | "network_error"
  | "nuki_busy_state"
  | "unknown_nuki_error";

interface UnlockDebugMeta {
  request_id: string;
  booking_id?: string;
  booking_access_id?: string;
  user_id: string;
  timestamp: string;
  chosen_smartlock_id?: string;
  resolved_smartlock_id?: string;
  nuki_endpoint?: string;
  nuki_method?: string;
  nuki_response_status?: number;
  nuki_response_body?: string;
  error_message?: string;
  request_duration_ms?: number;
  nuki_request_duration_ms?: number;
  duplicate_request: boolean;
  blocked_second_click: boolean;
  access_window_valid: boolean;
  payment_status_valid: boolean;
  booking_status_valid: boolean;
  booking_status?: string;
  payment_status?: string;
  retry_count: number;
  debug_status: DebugStatus;
}

interface NukiRequestResult {
  ok: boolean;
  endpoint: string;
  method: "GET" | "POST";
  resolvedSmartlockId?: string;
  status?: number;
  responseBody?: string;
  durationMs: number;
  retryCount: number;
  errorMessage?: string;
  debugStatus: DebugStatus;
}

function safeBodySnippet(body: string, max = 900): string {
  return (body || "").slice(0, max);
}

function getNukiHeaders(): Record<string, string> {
  const apiKey = Deno.env.get("NUKI_API_KEY");
  if (!apiKey) throw new Error("NUKI_API_KEY not configured");
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabaseUser.auth.getUser(token);
  if (error || !user) throw new Error("Not authenticated");
  return user;
}

async function checkIsAdmin(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data === true) return true;
  const { data: staffData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "staff" });
  return staffData === true;
}

function classifyNukiFailure(status?: number, body = "", message = ""): DebugStatus {
  const haystack = `${body} ${message}`.toLowerCase();

  if (status === 401 || haystack.includes("unauthorized") || haystack.includes("invalid token")) {
    return "invalid_token";
  }
  if (status === 403 || haystack.includes("forbidden") || haystack.includes("scope")) {
    return "forbidden_scope";
  }
  if (
    (status === 400 || status === 404) &&
    (haystack.includes("smartlockid") || haystack.includes("doesn't exist") || haystack.includes("not valid"))
  ) {
    return "invalid_smartlock_id";
  }
  if (status === 408 || haystack.includes("timed out") || haystack.includes("aborterror")) {
    return "timeout";
  }
  if (haystack.includes("offline") || haystack.includes("not reachable") || haystack.includes("not online")) {
    return "nuki_device_offline";
  }
  if (haystack.includes("busy") || haystack.includes("please try again later") || status === 409 || status === 423) {
    return "nuki_busy_state";
  }
  if (haystack.includes("network") || haystack.includes("failed to fetch") || haystack.includes("dns")) {
    return "network_error";
  }
  return "unknown_nuki_error";
}

function parseNukiStateFlags(payload: any) {
  const onlineCandidates = [
    payload?.isOnline,
    payload?.online,
    payload?.state?.online,
    payload?.state?.isOnline,
    payload?.smartlockState?.online,
  ];

  const explicitOnline = onlineCandidates.find((v) => typeof v === "boolean") as boolean | undefined;
  const serverState = payload?.serverState ?? payload?.state?.serverState ?? payload?.smartlockState?.serverState;
  const lockState = payload?.lastKnownLockState?.state ?? payload?.state?.state ?? payload?.lockState;

  const isOfflineByServerState =
    typeof serverState === "string"
      ? ["offline", "unreachable", "not_reachable", "not_online"].includes(serverState.toLowerCase())
      : false;

  return {
    explicitOnline,
    serverState,
    lockState,
    isOfflineByServerState,
  };
}

async function logUnlockAttempt(
  supabaseAdmin: any,
  params: { booking_access_id?: string; user_id: string; studio_id: string; smartlock_id: string; action: string; result: string; error_message?: string; debug?: UnlockDebugMeta }
) {
  const serialized = params.debug
    ? JSON.stringify({ ...params.debug, technical_error: params.error_message || null })
    : params.error_message;

  await supabaseAdmin.from("nuki_unlock_log").insert({
    booking_access_id: params.booking_access_id,
    user_id: params.user_id,
    studio_id: params.studio_id,
    smartlock_id: params.smartlock_id,
    action: params.action,
    result: params.result,
    error_message: serialized ? safeBodySnippet(serialized, 7000) : null,
  });
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Nuki API calls ---

function buildSmartlockIdCandidates(rawSmartlockId: string): string[] {
  const id = String(rawSmartlockId || "").trim();
  if (!id) return [];
  // The Nuki Web API uses decimal smartlock IDs directly — no hex conversion needed
  return [id];
}

async function nukiRequestWithIdFallback(params: {
  smartlockId: string;
  pathBuilder: (candidateId: string) => string;
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
}): Promise<NukiRequestResult> {
  const {
    smartlockId,
    pathBuilder,
    method = "GET",
    body,
    timeoutMs = 9000,
    maxRetries = 1,
  } = params;

  const headers = getNukiHeaders();
  const candidates = buildSmartlockIdCandidates(smartlockId);

  let lastFailure: NukiRequestResult | null = null;

  for (const candidate of candidates) {
    const endpoint = `${NUKI_API_BASE}${pathBuilder(candidate)}`;

    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
      const started = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

      try {
        const res = await fetch(endpoint, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const responseBody = await res.text();
        const durationMs = Math.round(performance.now() - started);

        if (res.ok) {
          return {
            ok: true,
            endpoint,
            method,
            resolvedSmartlockId: candidate,
            status: res.status,
            responseBody: safeBodySnippet(responseBody),
            durationMs,
            retryCount,
            debugStatus: "success",
          };
        }

        const debugStatus = classifyNukiFailure(res.status, responseBody);
        const failure: NukiRequestResult = {
          ok: false,
          endpoint,
          method,
          resolvedSmartlockId: candidate,
          status: res.status,
          responseBody: safeBodySnippet(responseBody),
          durationMs,
          retryCount,
          errorMessage: `Nuki API failed [${res.status}] for smartlockId '${candidate}': ${safeBodySnippet(responseBody)}`,
          debugStatus,
        };

        lastFailure = failure;

        const retryable = ["timeout", "network_error", "nuki_busy_state"].includes(debugStatus);
        if (retryable && retryCount < maxRetries) {
          await delay(350 * (retryCount + 1));
          continue;
        }

        // Try next candidate only for invalid-id style failures
        if (debugStatus === "invalid_smartlock_id") break;

        return failure;
      } catch (error) {
        clearTimeout(timeout);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const durationMs = Math.round(performance.now() - started);
        const debugStatus = classifyNukiFailure(undefined, "", errorMsg);

        const failure: NukiRequestResult = {
          ok: false,
          endpoint,
          method,
          resolvedSmartlockId: candidate,
          durationMs,
          retryCount,
          errorMessage: errorMsg,
          debugStatus,
        };

        lastFailure = failure;

        const retryable = ["timeout", "network_error", "nuki_busy_state"].includes(debugStatus);
        if (retryable && retryCount < maxRetries) {
          await delay(350 * (retryCount + 1));
          continue;
        }

        return failure;
      }
    }
  }

  return lastFailure ?? {
    ok: false,
    endpoint: `${NUKI_API_BASE}/smartlock/${smartlockId}`,
    method: "GET",
    durationMs: 0,
    retryCount: 0,
    debugStatus: "invalid_smartlock_id",
    errorMessage: `No valid smartlockId candidate found for '${smartlockId}'`,
  };
}

async function nukiGetSmartlocks() {
  const started = performance.now();
  const res = await fetch(`${NUKI_API_BASE}/smartlock`, { headers: getNukiHeaders() });
  const body = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    body: safeBodySnippet(body),
    durationMs: Math.round(performance.now() - started),
    debugStatus: res.ok ? "success" as const : classifyNukiFailure(res.status, body),
  };
}

async function nukiGetSmartlockStatus(smartlockId: string) {
  return await nukiRequestWithIdFallback({
    smartlockId,
    pathBuilder: (candidate) => `/smartlock/${candidate}`,
    method: "GET",
    maxRetries: 1,
  });
}

async function nukiUnlock(smartlockId: string) {
  return await nukiRequestWithIdFallback({
    smartlockId,
    pathBuilder: (candidate) => `/smartlock/${candidate}/action/unlock`,
    method: "POST",
    maxRetries: 1,
  });
}

async function nukiLock(smartlockId: string) {
  return await nukiRequestWithIdFallback({
    smartlockId,
    pathBuilder: (candidate) => `/smartlock/${candidate}/action/lock`,
    method: "POST",
    maxRetries: 1,
  });
}
async function nukiOpen(smartlockId: string) {
  return await nukiRequestWithIdFallback({
    smartlockId,
    pathBuilder: (candidate) => `/smartlock/${candidate}/action`,
    method: "POST",
    body: { action: 3 },
    maxRetries: 1,
  });
}

// --- Route handlers ---

// Rate limiting: track unlock attempts per user
const unlockAttempts = new Map<string, { count: number; resetAt: number }>();
const inFlightUnlockRequests = new Map<string, { userId: string; startedAt: number }>();
const RATE_LIMIT_MAX = 10; // max 10 unlocks per window
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DUPLICATE_LOCK_WINDOW_MS = 6000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = unlockAttempts.get(userId);
  if (!entry || now > entry.resetAt) {
    unlockAttempts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function shouldBlockDuplicate(bookingAccessId: string): boolean {
  const existing = inFlightUnlockRequests.get(bookingAccessId);
  if (!existing) return false;
  return Date.now() - existing.startedAt <= DUPLICATE_LOCK_WINDOW_MS;
}

async function handleUnlock(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const requestId = crypto.randomUUID();
  const requestStarted = Date.now();

  // Rate limit check
  if (!checkRateLimit(user.id)) {
    return new Response(JSON.stringify({ error: "Te veel pogingen. Probeer over een paar minuten opnieuw." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsedBody: any = null;
  try {
    parsedBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ongeldige request body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const booking_access_id = parsedBody?.booking_access_id;
  const door_action = parsedBody?.door_action || "unlock"; // "unlock" or "open"

  if (!booking_access_id) {
    return new Response(JSON.stringify({ error: "booking_access_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get access record
  const { data: access, error: accessError } = await supabaseAdmin
    .from("booking_access")
    .select("*")
    .eq("id", booking_access_id)
    .single();

  if (accessError || !access) {
    return new Response(JSON.stringify({ error: "Toegangsrecord niet gevonden" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  const baseDebug: UnlockDebugMeta = {
    request_id: requestId,
    booking_id: access.booking_id,
    booking_access_id,
    user_id: user.id,
    timestamp: now.toISOString(),
    chosen_smartlock_id: access.smartlock_id,
    duplicate_request: false,
    blocked_second_click: false,
    access_window_valid: false,
    payment_status_valid: false,
    booking_status_valid: false,
    retry_count: 0,
    debug_status: "unknown_nuki_error",
  };

  const sendDenied = async (
    status: number,
    userMessage: string,
    debugStatus: DebugStatus,
    technicalMessage?: string,
    overrides?: Partial<UnlockDebugMeta>,
  ) => {
    const debug: UnlockDebugMeta = {
      ...baseDebug,
      ...overrides,
      debug_status: debugStatus,
      error_message: technicalMessage,
      request_duration_ms: Date.now() - requestStarted,
    };

    await supabaseAdmin.from("booking_access").update({
      last_unlock_attempt: now.toISOString(),
      last_unlock_result: `error:${debugStatus}`,
      updated_at: now.toISOString(),
    }).eq("id", booking_access_id);

    await logUnlockAttempt(supabaseAdmin, {
      booking_access_id,
      user_id: user.id,
      studio_id: access.studio_id,
      smartlock_id: access.smartlock_id,
      action: "unlock",
      result: debugStatus,
      error_message: technicalMessage || userMessage,
      debug,
    });

    console.error("[NUKI][UNLOCK_DENIED]", JSON.stringify(debug));

    return new Response(JSON.stringify({ error: userMessage }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  if (shouldBlockDuplicate(booking_access_id)) {
    return await sendDenied(
      409,
      "Je verzoek is al in behandeling. Probeer het zo opnieuw.",
      "duplicate_unlock_request",
      "Duplicate unlock request blocked at backend",
      { duplicate_request: true, blocked_second_click: true },
    );
  }

  const lastAttemptMs = access.last_unlock_attempt ? new Date(access.last_unlock_attempt).getTime() : 0;
  if (lastAttemptMs && (Date.now() - lastAttemptMs) < DUPLICATE_LOCK_WINDOW_MS) {
    return await sendDenied(
      409,
      "Je verzoek is al in behandeling. Probeer het zo opnieuw.",
      "duplicate_unlock_request",
      "Duplicate unlock request blocked by lockout window",
      { duplicate_request: true, blocked_second_click: true },
    );
  }

  inFlightUnlockRequests.set(booking_access_id, { userId: user.id, startedAt: Date.now() });

  try {
    // Check user owns this access
    if (access.user_id !== user.id) {
      const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
      if (!isAdmin) {
        return await sendDenied(403, "Geen toegang", "booking_invalid", "booking_access does not belong to user");
      }
    }

    if (access.access_status === "revoked") {
      return await sendDenied(403, "Je toegang is ingetrokken.", "booking_invalid", "access_status revoked");
    }

    const accessStart = new Date(access.access_start);
    const accessEndFromAccess = new Date(access.access_end);

    // Determine if this is unlimited (24/7) access: no booking_id OR end date far in the future
    const unlimitedThreshold = new Date();
    unlimitedThreshold.setFullYear(unlimitedThreshold.getFullYear() + 5);
    const isUnlimitedAccess = !access.booking_id || accessEndFromAccess > unlimitedThreshold;

    let bookingStatusValid = true;
    let paymentStatusValid = true;
    let bookingStatus = "confirmed";

    if (isUnlimitedAccess) {
      // For unlimited access, only check the access window — no booking validation needed
      if (now < accessStart) {
        return await sendDenied(403, "Je toegang is nog niet actief.", "access_window_invalid", "unlimited access: too early", {
          access_window_valid: false,
          booking_status_valid: true,
          payment_status_valid: true,
        });
      }
      if (now > accessEndFromAccess) {
        return await sendDenied(403, "Je toegang is verlopen.", "access_window_invalid", "unlimited access: expired", {
          access_window_valid: false,
          booking_status_valid: true,
          payment_status_valid: true,
        });
      }
    } else {
      // Session-based access — validate booking
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("id, status, booking_date, start_time, duration_hours, stripe_session_id")
        .eq("id", access.booking_id)
        .single();

      if (!booking) {
        return await sendDenied(403, "Boeking niet gevonden.", "booking_invalid", "booking not found", {
          booking_status_valid: false,
          payment_status_valid: false,
        });
      }

      bookingStatusValid = booking.status === "confirmed";
      paymentStatusValid = booking.status === "confirmed";
      bookingStatus = booking.status;

      if (!bookingStatusValid) {
        return await sendDenied(403, "Boeking is niet geldig voor toegang.", "booking_invalid", `booking status invalid: ${booking.status}`, {
          booking_status_valid: false,
          payment_status_valid: paymentStatusValid,
          booking_status: booking.status,
          payment_status: paymentStatusValid ? "valid" : "invalid",
        });
      }

      if (!paymentStatusValid) {
        return await sendDenied(403, "Betalingsstatus is niet geldig voor toegang.", "payment_status_invalid", "payment status invalid", {
          booking_status_valid: bookingStatusValid,
          payment_status_valid: false,
          booking_status: booking.status,
          payment_status: "invalid",
        });
      }

      // Time window checks for session access
      const [startHour, startMin] = booking.start_time.split(":").map(Number);
      const sessionEnd = buildLocalDate(booking.booking_date, startHour + booking.duration_hours, startMin);
      const effectiveAccessEnd = accessEndFromAccess > sessionEnd ? sessionEnd : accessEndFromAccess;

      if (accessEndFromAccess.getTime() !== effectiveAccessEnd.getTime()) {
        await supabaseAdmin.from("booking_access").update({
          access_end: effectiveAccessEnd.toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", booking_access_id);
      }

      if (now > effectiveAccessEnd) {
        await supabaseAdmin.from("booking_access").update({
          access_status: "expired",
          updated_at: now.toISOString(),
        }).eq("id", booking_access_id);

        return await sendDenied(403, "Je toegang is verlopen.", "access_window_invalid", "outside access window: expired", {
          access_window_valid: false,
          booking_status_valid: bookingStatusValid,
          payment_status_valid: paymentStatusValid,
          booking_status: booking.status,
          payment_status: "valid",
        });
      }

      if (now < accessStart) {
        return await sendDenied(403, "Je toegang is nog niet actief.", "access_window_invalid", "outside access window: too early", {
          access_window_valid: false,
          booking_status_valid: bookingStatusValid,
          payment_status_valid: paymentStatusValid,
          booking_status: booking.status,
          payment_status: "valid",
        });
      }
    }

    // Nuki preflight: state check (device online / busy / valid lock id)
    const stateResult = await nukiGetSmartlockStatus(access.smartlock_id);
    let statePayload: any = null;
    if (stateResult.responseBody) {
      try {
        statePayload = JSON.parse(stateResult.responseBody);
      } catch {
        statePayload = null;
      }
    }

    const stateFlags = parseNukiStateFlags(statePayload);

    if (!stateResult.ok) {
      const status = ["timeout", "network_error", "nuki_device_offline", "nuki_busy_state"].includes(stateResult.debugStatus) ? 503 : 502;
      return await sendDenied(
        status,
        "Er is tijdelijk geen verbinding met het slot.",
        stateResult.debugStatus,
        stateResult.errorMessage,
        {
          access_window_valid: true,
          booking_status_valid: bookingStatusValid,
          payment_status_valid: paymentStatusValid,
           booking_status: bookingStatus,
          payment_status: "valid",
          nuki_endpoint: stateResult.endpoint,
          nuki_method: stateResult.method,
          nuki_response_status: stateResult.status,
          nuki_response_body: stateResult.responseBody,
          nuki_request_duration_ms: stateResult.durationMs,
          retry_count: stateResult.retryCount,
          resolved_smartlock_id: stateResult.resolvedSmartlockId,
        },
      );
    }

    if (stateFlags.explicitOnline === false || stateFlags.isOfflineByServerState) {
      return await sendDenied(503, "Er is tijdelijk geen verbinding met het slot.", "nuki_device_offline", "Nuki reported offline in state endpoint", {
        access_window_valid: true,
        booking_status_valid: bookingStatusValid,
        payment_status_valid: paymentStatusValid,
        booking_status: bookingStatus,
        payment_status: "valid",
        nuki_endpoint: stateResult.endpoint,
        nuki_method: stateResult.method,
        nuki_response_status: stateResult.status,
        nuki_response_body: stateResult.responseBody,
        nuki_request_duration_ms: stateResult.durationMs,
        retry_count: stateResult.retryCount,
        resolved_smartlock_id: stateResult.resolvedSmartlockId,
      });
    }

    // Attempt unlock, lock, or open with controlled retry policy
    const unlockResult = door_action === "open"
      ? await nukiOpen(access.smartlock_id)
      : door_action === "lock"
      ? await nukiLock(access.smartlock_id)
      : await nukiUnlock(access.smartlock_id);

    if (!unlockResult.ok) {
      const status = ["timeout", "network_error", "nuki_device_offline", "nuki_busy_state"].includes(unlockResult.debugStatus) ? 503 : 502;
      const userMessage =
        unlockResult.debugStatus === "access_window_invalid"
          ? "Je toegang is niet geldig op dit moment."
          : "De deur kon op dit moment niet worden geopend. Probeer het opnieuw.";

      return await sendDenied(status, userMessage, unlockResult.debugStatus, unlockResult.errorMessage, {
        access_window_valid: true,
        booking_status_valid: bookingStatusValid,
        payment_status_valid: paymentStatusValid,
        booking_status: bookingStatus,
        payment_status: "valid",
        nuki_endpoint: unlockResult.endpoint,
        nuki_method: unlockResult.method,
        nuki_response_status: unlockResult.status,
        nuki_response_body: unlockResult.responseBody,
        nuki_request_duration_ms: unlockResult.durationMs,
        retry_count: unlockResult.retryCount,
        resolved_smartlock_id: unlockResult.resolvedSmartlockId,
      });
    }

    const successDebug: UnlockDebugMeta = {
      ...baseDebug,
      debug_status: "success",
      access_window_valid: true,
      booking_status_valid: bookingStatusValid,
      payment_status_valid: paymentStatusValid,
      booking_status: bookingStatus,
      payment_status: "valid",
      resolved_smartlock_id: unlockResult.resolvedSmartlockId,
      nuki_endpoint: unlockResult.endpoint,
      nuki_method: unlockResult.method,
      nuki_response_status: unlockResult.status,
      nuki_response_body: unlockResult.responseBody,
      nuki_request_duration_ms: unlockResult.durationMs,
      retry_count: unlockResult.retryCount,
      request_duration_ms: Date.now() - requestStarted,
    };

    await supabaseAdmin.from("booking_access").update({
      last_unlock_attempt: now.toISOString(),
      last_unlock_result: "success",
      access_status: "active",
      updated_at: now.toISOString(),
    }).eq("id", booking_access_id);

    await logUnlockAttempt(supabaseAdmin, {
      booking_access_id,
      user_id: user.id,
      studio_id: access.studio_id,
      smartlock_id: access.smartlock_id,
      action: door_action === "open" ? "open" : "unlock",
      result: "success",
      debug: successDebug,
    });

    console.info(`[NUKI][${door_action.toUpperCase()}_SUCCESS]`, JSON.stringify(successDebug));

    return new Response(JSON.stringify({ success: true, message: door_action === "open" ? "Deur geopend" : "Deur ontgrendeld" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    inFlightUnlockRequests.delete(booking_access_id);
  }
}

async function handleAdminUnlock(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { smartlock_id, action = "unlock" } = await req.json();
  if (!smartlock_id) {
    return new Response(JSON.stringify({ error: "smartlock_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const opResult = action === "lock" ? await nukiLock(smartlock_id) : await nukiUnlock(smartlock_id);

  if (opResult.ok) {
    await logUnlockAttempt(supabaseAdmin, {
      user_id: user.id,
      studio_id: "admin",
      smartlock_id,
      action: `admin_${action}`,
      result: "success",
      debug: {
        request_id: crypto.randomUUID(),
        user_id: user.id,
        timestamp: new Date().toISOString(),
        chosen_smartlock_id: smartlock_id,
        resolved_smartlock_id: opResult.resolvedSmartlockId,
        nuki_endpoint: opResult.endpoint,
        nuki_method: opResult.method,
        nuki_response_status: opResult.status,
        nuki_response_body: opResult.responseBody,
        nuki_request_duration_ms: opResult.durationMs,
        request_duration_ms: opResult.durationMs,
        duplicate_request: false,
        blocked_second_click: false,
        access_window_valid: true,
        booking_status_valid: true,
        payment_status_valid: true,
        retry_count: opResult.retryCount,
        debug_status: "success",
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await logUnlockAttempt(supabaseAdmin, {
    user_id: user.id,
    studio_id: "admin",
    smartlock_id,
    action: `admin_${action}`,
    result: opResult.debugStatus,
    error_message: opResult.errorMessage,
    debug: {
      request_id: crypto.randomUUID(),
      user_id: user.id,
      timestamp: new Date().toISOString(),
      chosen_smartlock_id: smartlock_id,
      resolved_smartlock_id: opResult.resolvedSmartlockId,
      nuki_endpoint: opResult.endpoint,
      nuki_method: opResult.method,
      nuki_response_status: opResult.status,
      nuki_response_body: opResult.responseBody,
      nuki_request_duration_ms: opResult.durationMs,
      request_duration_ms: opResult.durationMs,
      duplicate_request: false,
      blocked_second_click: false,
      access_window_valid: true,
      booking_status_valid: true,
      payment_status_valid: true,
      retry_count: opResult.retryCount,
      debug_status: opResult.debugStatus,
      error_message: opResult.errorMessage,
    },
  });

  return new Response(JSON.stringify({ error: "Actie mislukt" }), {
    status: 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetSmartlocks(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const smartlockResult = await nukiGetSmartlocks();
    let locks: any[] = [];

    if (smartlockResult.ok) {
      try {
        locks = JSON.parse(smartlockResult.body || "[]");
      } catch {
        locks = [];
      }
    }

    console.log(`[NUKI] GET /smartlock status=${smartlockResult.status} body=${safeBodySnippet(smartlockResult.body || "")}`);

    const payload = {
      smartlocks: locks,
      debug_status: smartlockResult.debugStatus,
      _debug: {
        status: smartlockResult.status,
        duration_ms: smartlockResult.durationMs,
        key_configured: !!Deno.env.get("NUKI_API_KEY"),
      },
    };

    return new Response(JSON.stringify(payload), {
      status: smartlockResult.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[NUKI] smartlocks error: ${msg}`);
    return new Response(JSON.stringify({ error: "Kon Nuki sloten niet ophalen", detail: msg }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleGetStatus(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const smartlockId = url.searchParams.get("smartlock_id");
  if (!smartlockId) {
    return new Response(JSON.stringify({ error: "smartlock_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const statusResult = await nukiGetSmartlockStatus(smartlockId);
  if (!statusResult.ok) {
    return new Response(JSON.stringify({
      error: "Kon status niet ophalen",
      debug_status: statusResult.debugStatus,
      technical_error: statusResult.errorMessage,
      endpoint: statusResult.endpoint,
      response_status: statusResult.status,
      response_body: statusResult.responseBody,
    }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let statusPayload: any = null;
  try {
    statusPayload = statusResult.responseBody ? JSON.parse(statusResult.responseBody) : null;
  } catch {
    statusPayload = null;
  }

  return new Response(JSON.stringify({
    status: statusPayload,
    resolved_smartlock_id: statusResult.resolvedSmartlockId,
    endpoint: statusResult.endpoint,
    response_status: statusResult.status,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleTestConnection(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let performUnlock = false;
  if (req.method !== "GET") {
    try {
      const body = await req.json();
      performUnlock = body?.perform_unlock === true;
    } catch {
      performUnlock = false;
    }
  }

  const configuredLockRes = await supabaseAdmin
    .from("nuki_smartlocks")
    .select("smartlock_id, name, studio_id")
    .eq("is_active", true)
    .order("studio_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const configuredSmartlockId = configuredLockRes.data?.smartlock_id || null;

  const smartlocksResult = await nukiGetSmartlocks();
  let smartlocks: any[] = [];
  if (smartlocksResult.ok) {
    try {
      smartlocks = JSON.parse(smartlocksResult.body || "[]");
    } catch {
      smartlocks = [];
    }
  }

  const smartlockCandidates = configuredSmartlockId ? buildSmartlockIdCandidates(configuredSmartlockId) : [];
  const matched = smartlocks.find((lock: any) => smartlockCandidates.includes(String(lock?.smartlockId)));
  const targetSmartlockId = matched?.smartlockId ? String(matched.smartlockId) : configuredSmartlockId;

  const stateResult = targetSmartlockId ? await nukiGetSmartlockStatus(targetSmartlockId) : null;
  let statePayload: any = null;
  if (stateResult?.responseBody) {
    try {
      statePayload = JSON.parse(stateResult.responseBody);
    } catch {
      statePayload = null;
    }
  }

  const flags = parseNukiStateFlags(statePayload);

  let unlockResult: NukiRequestResult | null = null;
  if (performUnlock && targetSmartlockId) {
    unlockResult = await nukiUnlock(targetSmartlockId);
  }

  const debugStatus: DebugStatus = !smartlocksResult.ok
    ? smartlocksResult.debugStatus
    : !targetSmartlockId
    ? "invalid_smartlock_id"
    : stateResult && !stateResult.ok
    ? stateResult.debugStatus
    : performUnlock && unlockResult && !unlockResult.ok
    ? unlockResult.debugStatus
    : "success";

  const responsePayload = {
    success: debugStatus === "success",
    debug_status: debugStatus,
    checks: {
      nuki_api_key_valid: smartlocksResult.status !== 401,
      scopes_sufficient: smartlocksResult.status !== 403,
      smartlocks_found: smartlocks.length,
      nuki_web_active: smartlocks.length > 0,
      configured_smartlock_id: configuredSmartlockId,
      configured_smartlock_name: configuredLockRes.data?.name || null,
      matched_smartlock_id: matched?.smartlockId ? String(matched.smartlockId) : null,
      target_smartlock_id: targetSmartlockId,
      device_online: flags.explicitOnline ?? (flags.isOfflineByServerState ? false : null),
      server_state: flags.serverState ?? null,
      lock_state: flags.lockState ?? null,
      unlock_test: {
        attempted: performUnlock,
        success: unlockResult ? unlockResult.ok : null,
        response_status: unlockResult?.status ?? null,
        response_body: unlockResult?.responseBody ?? null,
        debug_status: unlockResult?.debugStatus ?? null,
      },
    },
    traces: {
      smartlocks_call: {
        status: smartlocksResult.status,
        body: smartlocksResult.body,
        duration_ms: smartlocksResult.durationMs,
      },
      state_call: stateResult
        ? {
            endpoint: stateResult.endpoint,
            status: stateResult.status,
            body: stateResult.responseBody,
            duration_ms: stateResult.durationMs,
            debug_status: stateResult.debugStatus,
          }
        : null,
    },
  };

  await logUnlockAttempt(supabaseAdmin, {
    user_id: user.id,
    studio_id: configuredLockRes.data?.studio_id || "admin",
    smartlock_id: targetSmartlockId || configuredSmartlockId || "unknown",
    action: "admin_test_connection",
    result: debugStatus,
    error_message: debugStatus === "success" ? undefined : `Test connection failed: ${debugStatus}`,
    debug: {
      request_id: crypto.randomUUID(),
      user_id: user.id,
      timestamp: new Date().toISOString(),
      chosen_smartlock_id: configuredSmartlockId || undefined,
      resolved_smartlock_id: targetSmartlockId || undefined,
      nuki_endpoint: unlockResult?.endpoint || stateResult?.endpoint || `${NUKI_API_BASE}/smartlock`,
      nuki_method: unlockResult?.method || stateResult?.method || "GET",
      nuki_response_status: unlockResult?.status || stateResult?.status || smartlocksResult.status,
      nuki_response_body: unlockResult?.responseBody || stateResult?.responseBody || smartlocksResult.body,
      request_duration_ms: (smartlocksResult.durationMs || 0) + (stateResult?.durationMs || 0) + (unlockResult?.durationMs || 0),
      nuki_request_duration_ms: (smartlocksResult.durationMs || 0) + (stateResult?.durationMs || 0) + (unlockResult?.durationMs || 0),
      duplicate_request: false,
      blocked_second_click: false,
      access_window_valid: true,
      booking_status_valid: true,
      payment_status_valid: true,
      retry_count: (stateResult?.retryCount || 0) + (unlockResult?.retryCount || 0),
      debug_status: debugStatus,
      error_message: debugStatus === "success" ? undefined : `Test connection failed: ${debugStatus}`,
    },
  });

  return new Response(JSON.stringify(responsePayload), {
    status: debugStatus === "success" ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCreateAccess(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { booking_id, access_type } = await req.json();
  if (!booking_id) {
    return new Response(JSON.stringify({ error: "booking_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isUnlimited = access_type === "unlimited";

  // Get booking
  const { data: booking, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", booking_id)
    .single();

  if (bErr || !booking) {
    return new Response(JSON.stringify({ error: "Boeking niet gevonden" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get smartlock for studio (or shared "all-studios" slot)
  let { data: smartlock } = await supabaseAdmin
    .from("nuki_smartlocks")
    .select("*")
    .eq("studio_id", booking.studio_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!smartlock) {
    const { data: sharedLock } = await supabaseAdmin
      .from("nuki_smartlocks")
      .select("*")
      .eq("studio_id", "all-studios")
      .eq("is_active", true)
      .maybeSingle();
    smartlock = sharedLock;
  }

  if (!smartlock) {
    return new Response(JSON.stringify({ error: "Geen Nuki slot gekoppeld aan deze ruimte" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessStart: Date;
  let accessEnd: Date;

  if (isUnlimited) {
    // Unlimited: start now, end far in the future (10 years)
    accessStart = new Date();
    accessEnd = new Date();
    accessEnd.setFullYear(accessEnd.getFullYear() + 10);
  } else {
    // Booking-based: 15 min before start, end at session end
    const bufferMinutes = 15;
    const [startHour, startMin] = booking.start_time.split(":").map(Number);
    accessStart = buildLocalDate(booking.booking_date, startHour, startMin - bufferMinutes);
    accessEnd = buildLocalDate(booking.booking_date, startHour + booking.duration_hours, startMin);
  }

  const accessStatus = isUnlimited ? "unlimited" : "scheduled";

  // Upsert access record
  const { data: existing } = await supabaseAdmin
    .from("booking_access")
    .select("id")
    .eq("booking_id", booking_id)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin.from("booking_access").update({
      access_start: accessStart.toISOString(),
      access_end: accessEnd.toISOString(),
      smartlock_id: smartlock.smartlock_id,
      access_status: accessStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("booking_access").insert({
      booking_id,
      user_id: booking.user_id,
      studio_id: booking.studio_id,
      smartlock_id: smartlock.smartlock_id,
      access_start: accessStart.toISOString(),
      access_end: accessEnd.toISOString(),
      access_status: accessStatus,
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleRevokeAccess(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { booking_access_id } = await req.json();
  if (!booking_access_id) {
    return new Response(JSON.stringify({ error: "booking_access_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabaseAdmin.from("booking_access").update({
    access_status: "revoked",
    updated_at: new Date().toISOString(),
  }).eq("id", booking_access_id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAutoProvision(_req: Request) {
  // Auto-provisioning is disabled — access is now managed manually by admin
  return new Response(JSON.stringify({ success: true, provisioned: false, reason: "auto_provision_disabled" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetUnlockLogs(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  const { data: logs } = await supabaseAdmin
    .from("nuki_unlock_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Enrich with profile data
  const userIds = [...new Set((logs || []).map((l: any) => l.user_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  const enriched = (logs || []).map((l: any) => {
    const p = profileMap.get(l.user_id);

    let debug: any = null;
    let debugStatus: DebugStatus | "legacy_error" = l.result === "success" ? "success" : "legacy_error";
    let technicalError = l.error_message || null;

    if (l.error_message) {
      try {
        const parsed = JSON.parse(l.error_message);
        if (parsed && typeof parsed === "object") {
          debug = parsed;
          debugStatus = parsed.debug_status || debugStatus;
          technicalError = parsed.technical_error || parsed.error_message || technicalError;
        }
      } catch {
        debugStatus = classifyNukiFailure(undefined, l.error_message, l.error_message);
      }
    }

    if (!l.error_message && l.result && l.result !== "success") {
      debugStatus = l.result;
    }

    return {
      ...l,
      profile_name: p?.full_name,
      profile_email: p?.email,
      debug_status: debugStatus,
      debug,
      technical_error: technicalError,
    };
  });

  return new Response(JSON.stringify({ logs: enriched }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetActiveAccess(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data } = await supabaseAdmin
    .from("booking_access")
    .select("*, bookings(booking_date, start_time, duration_hours, studio_id)")
    .in("access_status", ["scheduled", "active"])
    .order("access_start", { ascending: true });

  return new Response(JSON.stringify({ access_records: data || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAdminAccessList(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get all access records (recent 200)
  const { data: records } = await supabaseAdmin
    .from("booking_access")
    .select("*")
    .order("access_start", { ascending: false })
    .limit(200);

  // Enrich with profile data
  const userIds = [...new Set((records || []).map((r: any) => r.user_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  const enriched = (records || []).map((r: any) => {
    const p = profileMap.get(r.user_id);
    return { ...r, profile_name: p?.full_name, profile_email: p?.email };
  });

  return new Response(JSON.stringify({ records: enriched }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Compensation for access failures where remote fallback also fails: the
// session was disrupted through no fault of the customer.
const ACCESS_FAILURE_COMPENSATION_EUR = 10;

/**
 * Panic button: "I can't get in". Validates the caller's access window, then
 * tries a remote unlock of the entrance + room locks. If everything fails the
 * team is alerted and the customer is compensated automatically.
 */
async function handleAccessHelp(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();

  const { booking_access_id } = await req.json();
  if (!booking_access_id) {
    return new Response(JSON.stringify({ error: "booking_access_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: access } = await supabaseAdmin
    .from("booking_access").select("*").eq("id", booking_access_id).single();

  if (!access || access.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Toegangsrecord niet gevonden" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (access.access_status === "revoked") {
    return new Response(JSON.stringify({ error: "Je toegang is ingetrokken." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = new Date();
  // Allow the panic flow from 15 min before the window opens until it closes
  const panicStart = new Date(new Date(access.access_start).getTime() - 15 * 60 * 1000);
  if (now < panicStart || now > new Date(access.access_end)) {
    return new Response(JSON.stringify({ error: "Je hebt op dit moment geen actieve toegang." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Try remote unlock of every relevant lock (entrance first, then room)
  const { allLocks } = await resolveLocksForStudio(supabaseAdmin, access.studio_id);
  const locks = allLocks.length > 0 ? allLocks : [{ smartlock_id: access.smartlock_id }];
  const unlocked: string[] = [];
  for (const lock of locks) {
    const ok = await remoteUnlock(String(lock.smartlock_id));
    if (ok) unlocked.push(String(lock.smartlock_id));
  }

  const allFailed = unlocked.length === 0;

  await logUnlockAttempt(supabaseAdmin, {
    booking_access_id,
    user_id: user.id,
    studio_id: access.studio_id,
    smartlock_id: access.smartlock_id,
    action: "access_help",
    result: allFailed ? "all_locks_failed" : "remote_unlock_fallback",
    error_message: allFailed ? "Panic button: remote unlock failed on all locks" : undefined,
  });

  // Always alert the team — a panic button press is a signal even when the
  // remote fallback worked.
  const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email, phone").eq("id", user.id).single();
  const who = profile?.full_name || profile?.email || "Onbekend";
  const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
  if (adminRoles && adminRoles.length > 0) {
    await supabaseAdmin.from("notifications").insert(adminRoles.map((r: any) => ({
      user_id: r.user_id,
      title: allFailed ? "🚨 Klant komt er niet in!" : "⚠️ Toegangsprobleem (opgelost via remote unlock)",
      message: `${who} gebruikte de noodknop bij ${access.studio_id}.${allFailed ? ` Remote unlock MISLUKT — bel: ${profile?.phone || "geen nummer"}` : " Deur is op afstand geopend."}`,
      type: allFailed ? "error" : "warning",
      link: "/admin?tab=nuki",
    })));
  }

  if (allFailed) {
    // Automatic compensation, once per access record
    const { data: existingComp } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", "compensation")
      .eq("booking_id", access.booking_id)
      .limit(1);

    let compensated = false;
    if (!existingComp || existingComp.length === 0) {
      const { error: compErr } = await supabaseAdmin.rpc("wallet_apply", {
        p_user_id: user.id,
        p_amount: ACCESS_FAILURE_COMPENSATION_EUR,
        p_type: "compensation",
        p_booking_id: access.booking_id,
        p_note: "Compensatie: toegangsprobleem studio",
      });
      compensated = !compErr;
    }

    return new Response(JSON.stringify({
      success: false,
      remote_unlock: false,
      compensated,
      message: `We konden de deur niet op afstand openen. Het team is direct ingelicht en belt je zo snel mogelijk.${compensated ? ` Je hebt €${ACCESS_FAILURE_COMPENSATION_EUR} tegoed ontvangen voor het ongemak.` : ""}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    remote_unlock: true,
    message: "De deur is op afstand geopend. Het team is op de hoogte gebracht.",
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Admin: (re)provision booking-scoped access incl. keypad code. */
async function handleProvisionAccess(req: Request) {
  const user = await authenticateUser(req);
  const supabaseAdmin = getSupabaseAdmin();
  const isAdmin = await checkIsAdmin(supabaseAdmin, user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Geen admin rechten" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { booking_id } = await req.json();
  if (!booking_id) {
    return new Response(JSON.stringify({ error: "booking_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await provisionBookingAccess(supabaseAdmin, booking_id);
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 422,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Main router ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    // Route based on query parameter 'action'
    const action = url.searchParams.get("action") || path;

    switch (action) {
      case "unlock":
        return await handleUnlock(req);
      case "admin-unlock":
        return await handleAdminUnlock(req);
      case "smartlocks":
        return await handleGetSmartlocks(req);
      case "status":
        return await handleGetStatus(req);
      case "test-connection":
        return await handleTestConnection(req);
      case "create-access":
        return await handleCreateAccess(req);
      case "provision-access":
        return await handleProvisionAccess(req);
      case "access-help":
        return await handleAccessHelp(req);
      case "revoke-access":
        return await handleRevokeAccess(req);
      case "auto-provision":
        return await handleAutoProvision(req);
      case "unlock-logs":
        return await handleGetUnlockLogs(req);
      case "active-access":
        return await handleGetActiveAccess(req);
      case "admin-access-list":
        return await handleAdminAccessList(req);
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[NUKI-INTEGRATION] ERROR:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message === "Unauthorized" || message === "Not authenticated" ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
