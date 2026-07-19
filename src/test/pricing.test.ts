import { describe, expect, it } from "vitest";
import {
  computeStudioPricing,
  DEFAULT_OFFPEAK,
  type OffPeakConfig,
} from "../../supabase/functions/_shared/pricing";

const ENABLED: OffPeakConfig = { enabled: true, discount_pct: 30, weekday_end_hour: 17 };

// 2026-07-20 is a Monday, 2026-07-25 a Saturday
const MONDAY = "2026-07-20";
const SATURDAY = "2026-07-25";

describe("computeStudioPricing", () => {
  it("charges full price when off-peak is disabled (the default)", () => {
    const r = computeStudioPricing(50, MONDAY, "10:00", 4, 0, DEFAULT_OFFPEAK);
    expect(r.total).toBe(200);
    expect(r.discount).toBe(0);
  });

  it("discounts weekday daytime hours", () => {
    // Monday 10:00-14:00, all 4 hours before 17:00 → 30% off
    const r = computeStudioPricing(50, MONDAY, "10:00", 4, 0, ENABLED);
    expect(r.total).toBe(140);
    expect(r.discount).toBe(60);
    expect(r.offPeakHours).toBe(4);
  });

  it("splits a session that crosses the peak boundary", () => {
    // Monday 15:00-19:00: hours 15,16 off-peak; 17,18 peak
    const r = computeStudioPricing(50, MONDAY, "15:00", 4, 0, ENABLED);
    expect(r.offPeakHours).toBe(2);
    expect(r.total).toBe(2 * 35 + 2 * 50);
  });

  it("never discounts weekend hours", () => {
    const r = computeStudioPricing(50, SATURDAY, "10:00", 4, 0, ENABLED);
    expect(r.total).toBe(200);
    expect(r.offPeakHours).toBe(0);
  });

  it("applies free credit hours before pricing the remainder", () => {
    // 4h booking, 2 free hours → only hours 12:00+13:00 remain... free hours are
    // chronological, so the paid hours are 12:00 and 13:00 (both off-peak Monday)
    const r = computeStudioPricing(50, MONDAY, "10:00", 4, 2, ENABLED);
    expect(r.paidHours).toBe(2);
    expect(r.total).toBe(70);
  });

  it("handles sessions that run past midnight into the next day", () => {
    // Friday 22:00 + 4h → Fri 22,23 (peak) + Sat 00,01 (weekend, no discount)
    const friday = "2026-07-24";
    const r = computeStudioPricing(50, friday, "22:00", 4, 0, ENABLED);
    expect(r.total).toBe(200);
  });

  it("fully free bookings cost nothing", () => {
    const r = computeStudioPricing(50, MONDAY, "10:00", 3, 3, ENABLED);
    expect(r.total).toBe(0);
    expect(r.paidHours).toBe(0);
  });
});
