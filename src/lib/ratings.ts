// Pure helpers for aggregating and displaying review ratings.

export interface RatingLike {
  rating: number;
  status?: string;
}

export interface RatingSummary {
  count: number;
  average: number; // 0 when no reviews
  /** rating (1-5) -> number of reviews with that rating */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Aggregate a list of reviews, counting only approved ones by default. */
export function summarizeRatings(reviews: RatingLike[], approvedOnly = true): RatingSummary {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  let sum = 0;
  let count = 0;
  for (const r of reviews) {
    if (approvedOnly && r.status && r.status !== "approved") continue;
    const clamped = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[clamped]++;
    sum += clamped;
    count++;
  }
  return { count, average: count ? sum / count : 0, distribution };
}

/** Round an average to one decimal for display (e.g. 4.3). */
export function formatAverage(avg: number): string {
  return (Math.round(avg * 10) / 10).toFixed(1);
}

/** Full + half + empty star counts for a 0-5 average (half rounds at .25/.75). */
export function starBreakdown(avg: number): { full: number; half: boolean; empty: number } {
  const clamped = Math.min(5, Math.max(0, avg));
  const full = Math.floor(clamped);
  const frac = clamped - full;
  const half = frac >= 0.25 && frac < 0.75;
  const roundedUp = frac >= 0.75 ? 1 : 0;
  const filled = full + roundedUp;
  return { full: filled, half, empty: 5 - filled - (half ? 1 : 0) };
}
