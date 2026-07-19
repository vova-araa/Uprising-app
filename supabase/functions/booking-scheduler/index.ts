// Periodic maintenance loop, triggered by pg_cron every 10 minutes:
// 1. Booking reminders 24h and 2h before start (in-app + e-mail + web push);
//    the 2h reminder carries the door code so the access info is at hand.
// 2. Expire stale pending_payment bookings (>30 min) and refund any wallet
//    credit that was applied to them.
// 3. Sweep expired wallet credit (ledger-visible, never silent).
// 4. Win-back outreach for lapsed users and waitlist expiry.
//
// Every action is idempotent and time-gated (notifications_sent flags,
// status filters, sweep markers), so extra invocations are harmless.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildLocalDate } from "../_shared/nuki.ts";

const STUDIO_DISPLAY_NAME: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};

const PENDING_PAYMENT_TTL_MIN = 30;

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function sendPush(userId: string, title: string, message: string, link: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-web-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ user_ids: [userId], title, message, link }),
    });
  } catch (e) {
    console.error("[SCHEDULER] push failed:", e);
  }
}

async function processReminders(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<{ sent24: number; sent2: number }> {
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(now + 36 * 3600 * 1000).toISOString().split("T")[0];

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, studio_id, booking_date, start_time, duration_hours, notifications_sent")
    .eq("status", "confirmed")
    .gte("booking_date", today)
    .lte("booking_date", tomorrow);

  let sent24 = 0;
  let sent2 = 0;

  for (const b of bookings || []) {
    const [h, m] = String(b.start_time).split(":").map(Number);
    const start = buildLocalDate(b.booking_date, h, m).getTime();
    const hoursUntil = (start - now) / 3_600_000;
    if (hoursUntil <= 0) continue;

    const sent = (b.notifications_sent as Record<string, boolean> | null) || {};
    const studioName = STUDIO_DISPLAY_NAME[b.studio_id] || b.studio_id;
    const timeLabel = `${b.booking_date} om ${b.start_time}`;

    // 24h reminder (window guards against backfilling old bookings)
    if (!sent.reminder_24h && hoursUntil <= 24 && hoursUntil > 20) {
      const title = "Sessie morgen 🎙️";
      const message = `Je ${studioName} sessie is ${timeLabel} (${b.duration_hours}u). Annuleren of verzetten kan tot 4 uur vooraf in de app.`;

      await supabase.from("notifications").insert({
        user_id: b.user_id, title, message, type: "info", link: "/account?tab=bookings",
      });
      await sendPush(b.user_id, title, message, "/account?tab=bookings");

      const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", b.user_id).single();
      if (profile?.email) {
        const messageId = `booking-reminder-24h-${b.id}`;
        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: profile.email,
            subject: `Herinnering: ${studioName} morgen ${b.start_time}`,
            html: `<p>Hoi ${profile.full_name || ""},</p><p>Een reminder voor je sessie: <strong>${studioName}</strong>, ${timeLabel} (${b.duration_hours} uur).</p><p>Verzetten of annuleren kan tot 4 uur van tevoren in de app.</p><p>Tot morgen!<br/>Uprising Studio</p>`,
            message_id: messageId,
            purpose: "transactional",
          },
        });
      }

      await supabase.from("bookings").update({
        notifications_sent: { ...sent, reminder_24h: true },
        updated_at: new Date().toISOString(),
      }).eq("id", b.id);
      sent.reminder_24h = true;
      sent24++;
    }

    // 2h reminder with access info
    if (!sent.reminder_2h && hoursUntil <= 2 && hoursUntil > 0.5) {
      const title = "Bijna tijd! 🚀";
      const message = `Je ${studioName} sessie start om ${b.start_time}. Vanaf 15 min vooraf open je de voordeur met de knop in de app.`;

      await supabase.from("notifications").insert({
        user_id: b.user_id, title, message, type: "info", link: "/account?tab=bookings",
      });
      await sendPush(b.user_id, title, message, "/account?tab=bookings");

      await supabase.from("bookings").update({
        notifications_sent: { ...sent, reminder_2h: true },
        updated_at: new Date().toISOString(),
      }).eq("id", b.id);
      sent2++;
    }
  }

  return { sent24, sent2 };
}

async function expireStalePendingPayments(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_TTL_MIN * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("bookings")
    .select("id, user_id, wallet_applied, studio_id, booking_date, start_time")
    .eq("status", "pending_payment")
    .lt("created_at", cutoff);

  let expired = 0;
  for (const b of stale || []) {
    const { data: updated } = await supabase
      .from("bookings")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("status", "pending_payment")
      .select("id");
    if (!updated || updated.length === 0) continue;

    if (Number(b.wallet_applied) > 0) {
      const { error } = await supabase.rpc("wallet_apply", {
        p_user_id: b.user_id,
        p_amount: Number(b.wallet_applied),
        p_type: "refund_credit",
        p_booking_id: b.id,
        p_note: "Terugboeking: betaling niet afgerond",
      });
      if (error) console.error("[SCHEDULER] wallet refund on expiry failed:", error);
    }
    expired++;
  }
  return expired;
}

async function sweepExpiredWalletCredit(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  const { data: expiredCredits } = await supabase
    .from("wallet_transactions")
    .select("id, user_id, amount, note")
    .gt("amount", 0)
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());

  let swept = 0;
  for (const tx of expiredCredits || []) {
    // Sweep marker prevents double-expiry of the same credit
    const marker = `sweep:${tx.id}`;
    const { data: alreadySwept } = await supabase
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", tx.user_id)
      .eq("type", "expiry")
      .eq("note", marker)
      .limit(1);
    if (alreadySwept && alreadySwept.length > 0) continue;

    const { data: profile } = await supabase
      .from("profiles").select("credit_balance").eq("id", tx.user_id).single();
    const balance = Number(profile?.credit_balance || 0);
    const toExpire = Math.min(Number(tx.amount), balance);
    if (toExpire <= 0) {
      // Balance already spent — record a zero-amount marker so we don't recheck
      await supabase.from("wallet_transactions").insert({
        user_id: tx.user_id, amount: 0, type: "expiry", note: marker,
      });
      continue;
    }

    const { error } = await supabase.rpc("wallet_apply", {
      p_user_id: tx.user_id,
      p_amount: -toExpire,
      p_type: "expiry",
      p_note: marker,
    });
    if (!error) {
      swept++;
      await supabase.from("notifications").insert({
        user_id: tx.user_id,
        title: "Tegoed verlopen",
        message: `€${toExpire} tegoed is verlopen.`,
        type: "info",
        link: "/account",
      });
    }
  }
  return swept;
}

/**
 * Weekly content-goal nudge for creators with a coach profile: Monday
 * morning (Amsterdam), at most once per 6 days.
 */
async function processWeeklyContentReminders(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  const nowAms = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  if (nowAms.getDay() !== 1 || nowAms.getHours() < 9 || nowAms.getHours() >= 12) return 0;

  const cutoff = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("user_id, artist_name, weekly_content_goal, last_weekly_reminder_at")
    .eq("weekly_reminder", true)
    .not("weekly_content_goal", "is", null);

  let sent = 0;
  for (const c of creators || []) {
    if (c.last_weekly_reminder_at && c.last_weekly_reminder_at > cutoff) continue;

    // Generate this week's plan so it's ready when they open the coach
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/coach-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ mode: "weekly", user_id: c.user_id, force: true }),
      });
    } catch (e) {
      console.error("[SCHEDULER] weekly plan generation failed:", e);
    }

    const title = "Je weekplan staat klaar 🎯";
    const message = `${c.weekly_content_goal} post${Number(c.weekly_content_goal) === 1 ? "" : "s"} deze week — de coach heeft concrete ideeën en captions voor je klaargezet.`;
    await supabase.from("notifications").insert({
      user_id: c.user_id, title, message, type: "info", link: "/coach",
    });
    await sendPush(c.user_id, title, message, "/coach");
    await supabase.from("creator_profiles")
      .update({ last_weekly_reminder_at: new Date().toISOString() })
      .eq("user_id", c.user_id);
    sent++;
  }
  return sent;
}

const WINBACK_MIN_DAYS = 60;
const WINBACK_MAX_DAYS = 90;
const WINBACK_COOLDOWN_DAYS = 180;
const WINBACK_CREDIT_EUR = 10;
const WINBACK_CREDIT_VALID_DAYS = 30;

/**
 * Win-back: users whose last confirmed booking is 60-90 days ago get a small
 * comeback credit (once per 180 days). Multi-channel: in-app + push + e-mail.
 */
async function processWinback(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  const now = Date.now();
  const minCutoff = new Date(now - WINBACK_MAX_DAYS * 86_400_000).toISOString().split("T")[0];
  const maxCutoff = new Date(now - WINBACK_MIN_DAYS * 86_400_000).toISOString().split("T")[0];

  // Users whose most recent confirmed booking falls in the lapse window
  const { data: lastBookings } = await supabase
    .from("bookings")
    .select("user_id, booking_date")
    .eq("status", "confirmed")
    .order("booking_date", { ascending: false })
    .limit(2000);

  const latestByUser = new Map<string, string>();
  for (const b of lastBookings || []) {
    if (!latestByUser.has(b.user_id)) latestByUser.set(b.user_id, b.booking_date);
  }

  const lapsedUserIds = [...latestByUser.entries()]
    .filter(([, date]) => date >= minCutoff && date <= maxCutoff)
    .map(([userId]) => userId);
  if (lapsedUserIds.length === 0) return 0;

  const cooldownCutoff = new Date(now - WINBACK_COOLDOWN_DAYS * 86_400_000).toISOString();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, last_winback_at")
    .in("id", lapsedUserIds);

  let sent = 0;
  for (const p of profiles || []) {
    if (p.last_winback_at && p.last_winback_at > cooldownCutoff) continue;

    const expiresAt = new Date(now + WINBACK_CREDIT_VALID_DAYS * 86_400_000).toISOString();
    const { error: creditErr } = await supabase.rpc("wallet_apply", {
      p_user_id: p.id,
      p_amount: WINBACK_CREDIT_EUR,
      p_type: "compensation",
      p_note: "We missen je — comeback tegoed",
      p_expires_at: expiresAt,
    });
    if (creditErr) continue;

    const title = "We missen je in de studio! 🎶";
    const message = `Er staat €${WINBACK_CREDIT_EUR} tegoed voor je klaar (30 dagen geldig). Kom je weer een sessie draaien?`;

    await supabase.from("notifications").insert({
      user_id: p.id, title, message, type: "info", link: "/book",
    });
    await sendPush(p.id, title, message, "/book");
    if (p.email) {
      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: p.email,
          subject: "We missen je bij Uprising Studio — €10 tegoed",
          html: `<p>Hoi ${p.full_name || ""},</p><p>Het is even geleden! Er staat <strong>€${WINBACK_CREDIT_EUR} tegoed</strong> voor je klaar in de app — 30 dagen geldig voor elke studioboeking.</p><p>Tot snel!<br/>Uprising Studio</p>`,
          message_id: `winback-${p.id}-${new Date().toISOString().split("T")[0]}`,
          purpose: "transactional",
        },
      });
    }

    await supabase.from("profiles")
      .update({ last_winback_at: new Date().toISOString() })
      .eq("id", p.id);
    sent++;
  }
  return sent;
}

// Invoice reminders: sent-but-unpaid label invoices get a reminder every
// ~7 days (max 3 times), so labels are nudged without being spammed.
const INVOICE_REMINDER_DAYS = 7;
const INVOICE_MAX_REMINDERS = 3;

async function processInvoiceReminders(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<number> {
  const now = Date.now();
  const { data: invoices } = await supabase
    .from("label_invoices")
    .select("id, label_id, invoice_number, total, sent_at, last_reminder_at, reminder_count, term")
    .eq("status", "sent");

  let sent = 0;
  for (const inv of invoices || []) {
    if ((inv.reminder_count || 0) >= INVOICE_MAX_REMINDERS) continue;
    const anchor = inv.last_reminder_at || inv.sent_at;
    if (!anchor) continue;
    if (now - new Date(anchor).getTime() < INVOICE_REMINDER_DAYS * 86_400_000) continue;

    const { data: label } = await supabase.from("labels").select("name, contact_email, contact_name").eq("id", inv.label_id).single();
    if (!label?.contact_email) continue;

    await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: label.contact_email,
        subject: `Herinnering: factuur ${inv.invoice_number} — Uprising Studio`,
        html: `<p>Beste ${label.contact_name || label.name},</p><p>Een vriendelijke herinnering: factuur <strong>${inv.invoice_number}</strong>${inv.term ? ` (${inv.term})` : ""} van <strong>EUR ${Number(inv.total).toFixed(2)}</strong> staat nog open.</p><p>Na ontvangst hogen we het uren-tegoed direct op. Al betaald? Dan mag je deze mail negeren.</p><p>Met vriendelijke groet,<br/>Uprising Studio</p>`,
        message_id: `invoice-reminder-${inv.id}-${(inv.reminder_count || 0) + 1}`,
        purpose: "transactional",
      },
    });
    await supabase.from("label_invoices").update({
      last_reminder_at: new Date().toISOString(),
      reminder_count: (inv.reminder_count || 0) + 1,
    }).eq("id", inv.id);
    sent++;
  }
  return sent;
}

Deno.serve(async (req) => {
  // pg_cron calls this with the project's anon key; manual runs may use the
  // service role key. All work is idempotent, but reject anonymous internet
  // traffic without any known key.
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const known = [Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), Deno.env.get("SUPABASE_ANON_KEY")].filter(Boolean);
  if (!token || !known.includes(token)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseAdmin();
  const results: Record<string, unknown> = {};

  try {
    const reminders = await processReminders(supabase);
    results.reminders = reminders;
  } catch (e) {
    console.error("[SCHEDULER] reminders failed:", e);
    results.reminders_error = String(e);
  }

  try {
    results.expired_pending = await expireStalePendingPayments(supabase);
  } catch (e) {
    console.error("[SCHEDULER] pending expiry failed:", e);
    results.pending_error = String(e);
  }

  try {
    results.wallet_credits_swept = await sweepExpiredWalletCredit(supabase);
  } catch (e) {
    console.error("[SCHEDULER] wallet sweep failed:", e);
    results.wallet_error = String(e);
  }

  try {
    results.winback_sent = await processWinback(supabase);
  } catch (e) {
    console.error("[SCHEDULER] winback failed:", e);
    results.winback_error = String(e);
  }

  try {
    results.weekly_content_reminders = await processWeeklyContentReminders(supabase);
  } catch (e) {
    console.error("[SCHEDULER] weekly content reminders failed:", e);
  }

  try {
    // Expire waitlist entries for dates that have passed
    await supabase
      .from("booking_waitlist")
      .update({ status: "expired" })
      .in("status", ["waiting", "notified"])
      .lt("booking_date", new Date().toISOString().split("T")[0]);
  } catch (e) {
    console.error("[SCHEDULER] waitlist expiry failed:", e);
  }

  try {
    results.invoice_reminders = await processInvoiceReminders(supabase);
  } catch (e) {
    console.error("[SCHEDULER] invoice reminders failed:", e);
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { "Content-Type": "application/json" },
  });
});
