// Pure cancellation-policy computation, shared between the cancel-booking
// edge function (Deno) and the vitest suite (src/test). Keep this file free
// of Deno/browser-specific imports.

export const STUDIO_PRICES: Record<string, number> = {
  "studio-1": 50,
  "studio-2": 30,
  "content-room": 35,
};

// Cancellation policy (market-standard for self-service studios):
// - >= 48h before start: cash refund to the original payment method
// - >= 4h before start: refund as wallet credit (valid 3 months)
// - < 4h: no refund
// - Grace period: cancelling within 1h of booking is always a full cash
//   refund, unless the session starts within 2h.
export const CASH_REFUND_HOURS = 48;
export const WALLET_REFUND_HOURS = 4;
export const GRACE_PERIOD_MS = 60 * 60 * 1000;
export const GRACE_MIN_LEAD_HOURS = 2;
export const WALLET_CREDIT_VALID_DAYS = 90;

export type RefundKind = "none" | "cash" | "wallet" | "hours" | "mixed";

export interface RefundPlan {
  kind: RefundKind;
  cashAmount: number;      // refunded to original payment method via Stripe
  walletAmount: number;    // credited to in-app wallet
  restoreHours: number;    // studio credit-hours restored
  reason: string;          // machine-readable policy bucket
}

export interface CancellableBooking {
  status: string;
  session_type: string;
  total_price: number;
  wallet_applied: number;
  duration_hours: number;
  studio_id: string;
  created_at: string;
}

export function computeRefundPlan(
  booking: CancellableBooking,
  hoursUntilStart: number,
  now: number = Date.now(),
): RefundPlan {
  const paidCash = Math.max(0, (booking.total_price || 0) - (booking.wallet_applied || 0));
  const paidWallet = booking.wallet_applied || 0;

  // Credit-hour sessions: hours that were deducted get restored on any
  // cancellation outside the no-refund window.
  const pricePerHour = STUDIO_PRICES[booking.studio_id] || 0;
  const paidHours = pricePerHour > 0 ? Math.round((booking.total_price || 0) / pricePerHour) : 0;
  const usedCreditHours = booking.session_type === "credit"
    ? Math.max(0, booking.duration_hours - paidHours)
    : 0;

  // Unpaid bookings: nothing was charged; wallet part (if any) always returns.
  if (booking.status === "pending_payment" || booking.status === "pending") {
    return {
      kind: paidWallet > 0 ? "wallet" : "none",
      cashAmount: 0,
      walletAmount: paidWallet,
      restoreHours: usedCreditHours,
      reason: "unpaid",
    };
  }

  const withinGrace = now - new Date(booking.created_at).getTime() <= GRACE_PERIOD_MS
    && hoursUntilStart >= GRACE_MIN_LEAD_HOURS;

  if (withinGrace || hoursUntilStart >= CASH_REFUND_HOURS) {
    return {
      kind: paidCash > 0 && paidWallet > 0 ? "mixed" : paidCash > 0 ? "cash" : paidWallet > 0 ? "wallet" : usedCreditHours > 0 ? "hours" : "none",
      cashAmount: paidCash,
      walletAmount: paidWallet,
      restoreHours: usedCreditHours,
      reason: withinGrace ? "grace_period" : "cash_window",
    };
  }

  if (hoursUntilStart >= WALLET_REFUND_HOURS) {
    return {
      kind: paidCash + paidWallet > 0 ? "wallet" : usedCreditHours > 0 ? "hours" : "none",
      cashAmount: 0,
      walletAmount: paidCash + paidWallet,
      restoreHours: usedCreditHours,
      reason: "wallet_window",
    };
  }

  return { kind: "none", cashAmount: 0, walletAmount: 0, restoreHours: 0, reason: "late" };
}
