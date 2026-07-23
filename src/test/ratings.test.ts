import { describe, it, expect } from "vitest";
import { summarizeRatings, formatAverage, starBreakdown } from "@/lib/ratings";

describe("summarizeRatings", () => {
  it("returns zeroed summary for no reviews", () => {
    const s = summarizeRatings([]);
    expect(s.count).toBe(0);
    expect(s.average).toBe(0);
  });

  it("averages approved reviews and builds the distribution", () => {
    const s = summarizeRatings([{ rating: 5 }, { rating: 4 }, { rating: 3 }]);
    expect(s.count).toBe(3);
    expect(s.average).toBeCloseTo(4);
    expect(s.distribution[5]).toBe(1);
    expect(s.distribution[4]).toBe(1);
    expect(s.distribution[3]).toBe(1);
  });

  it("excludes non-approved reviews by default", () => {
    const s = summarizeRatings([{ rating: 5, status: "approved" }, { rating: 1, status: "pending" }]);
    expect(s.count).toBe(1);
    expect(s.average).toBe(5);
  });

  it("includes all when approvedOnly is false", () => {
    const s = summarizeRatings([{ rating: 5, status: "approved" }, { rating: 1, status: "pending" }], false);
    expect(s.count).toBe(2);
    expect(s.average).toBe(3);
  });

  it("clamps out-of-range ratings", () => {
    const s = summarizeRatings([{ rating: 9 }, { rating: 0 }]);
    expect(s.distribution[5]).toBe(1);
    expect(s.distribution[1]).toBe(1);
  });
});

describe("formatAverage", () => {
  it("shows one decimal", () => {
    expect(formatAverage(4.333)).toBe("4.3");
    expect(formatAverage(5)).toBe("5.0");
  });
});

describe("starBreakdown", () => {
  it("all full for 5", () => {
    expect(starBreakdown(5)).toEqual({ full: 5, half: false, empty: 0 });
  });
  it("half star for .5", () => {
    expect(starBreakdown(4.5)).toEqual({ full: 4, half: true, empty: 0 });
  });
  it("rounds .8 up to a full star", () => {
    expect(starBreakdown(3.8)).toEqual({ full: 4, half: false, empty: 1 });
  });
  it("no stars for 0", () => {
    expect(starBreakdown(0)).toEqual({ full: 0, half: false, empty: 5 });
  });
});
