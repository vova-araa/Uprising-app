import { describe, expect, it } from "vitest";
import {
  computeRefundPlan,
  type CancellableBooking,
} from "../../supabase/functions/_shared/cancellation-policy";

const base: CancellableBooking = {
  status: "confirmed",
  session_type: "single",
  total_price: 100,
  wallet_applied: 0,
  duration_hours: 2,
  studio_id: "studio-1",
  created_at: new Date("2026-01-01T10:00:00Z").toISOString(),
};

// "now" well past the 1h grace period after created_at
const NOW = new Date("2026-01-02T10:00:00Z").getTime();

describe("computeRefundPlan", () => {
  it("gives a cash refund at 48h or more before start", () => {
    const plan = computeRefundPlan(base, 48, NOW);
    expect(plan.kind).toBe("cash");
    expect(plan.cashAmount).toBe(100);
    expect(plan.walletAmount).toBe(0);
  });

  it("gives wallet credit between 4h and 48h before start", () => {
    const plan = computeRefundPlan(base, 24, NOW);
    expect(plan.kind).toBe("wallet");
    expect(plan.cashAmount).toBe(0);
    expect(plan.walletAmount).toBe(100);
  });

  it("gives nothing under 4h before start", () => {
    const plan = computeRefundPlan(base, 3, NOW);
    expect(plan.kind).toBe("none");
    expect(plan.cashAmount + plan.walletAmount + plan.restoreHours).toBe(0);
    expect(plan.reason).toBe("late");
  });

  it("honours the 1h grace period with a full cash refund", () => {
    const justBooked = { ...base, created_at: new Date(NOW - 30 * 60 * 1000).toISOString() };
    const plan = computeRefundPlan(justBooked, 24, NOW);
    expect(plan.kind).toBe("cash");
    expect(plan.cashAmount).toBe(100);
    expect(plan.reason).toBe("grace_period");
  });

  it("denies the grace period when the session starts within 2h", () => {
    const justBooked = { ...base, created_at: new Date(NOW - 30 * 60 * 1000).toISOString() };
    const plan = computeRefundPlan(justBooked, 1.5, NOW);
    expect(plan.kind).toBe("none");
  });

  it("splits mixed cash + wallet payments in the cash window", () => {
    const mixed = { ...base, total_price: 100, wallet_applied: 30 };
    const plan = computeRefundPlan(mixed, 72, NOW);
    expect(plan.kind).toBe("mixed");
    expect(plan.cashAmount).toBe(70);
    expect(plan.walletAmount).toBe(30);
  });

  it("returns everything as wallet credit in the wallet window for mixed payments", () => {
    const mixed = { ...base, total_price: 100, wallet_applied: 30 };
    const plan = computeRefundPlan(mixed, 12, NOW);
    expect(plan.kind).toBe("wallet");
    expect(plan.cashAmount).toBe(0);
    expect(plan.walletAmount).toBe(100);
  });

  it("restores credit hours for credit sessions", () => {
    // 3h booking, 1h paid (€50 at studio-1 rate) → 2 credit hours were used
    const credit = { ...base, session_type: "credit", duration_hours: 3, total_price: 50 };
    const plan = computeRefundPlan(credit, 24, NOW);
    expect(plan.restoreHours).toBe(2);
    expect(plan.walletAmount).toBe(50);
  });

  it("refunds wallet but nothing else for unpaid pending_payment bookings", () => {
    const unpaid = { ...base, status: "pending_payment", wallet_applied: 20 };
    const plan = computeRefundPlan(unpaid, 1, NOW);
    expect(plan.kind).toBe("wallet");
    expect(plan.walletAmount).toBe(20);
    expect(plan.cashAmount).toBe(0);
    expect(plan.reason).toBe("unpaid");
  });

  it("gives members (free bookings) a clean cancel with no refund artifacts", () => {
    const member = { ...base, session_type: "member", total_price: 0 };
    const plan = computeRefundPlan(member, 24, NOW);
    expect(plan.kind).toBe("none");
    expect(plan.walletAmount).toBe(0);
  });
});
