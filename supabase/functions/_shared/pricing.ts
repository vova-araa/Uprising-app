// Pure pricing computation, shared between the create-booking edge function
// (Deno) and the frontend/vitest (src). Keep free of Deno/browser imports.
//
// Off-peak pricing: weekday hours before a configurable end hour get a
// percentage discount — the proven occupancy lever for self-service studios
// (fills empty weekday daytime hours). Disabled by default; enable by adding
// an app_config row:
//   config_key: "offpeak_pricing"
//   config_value: { "enabled": true, "discount_pct": 30, "weekday_end_hour": 17 }

export interface OffPeakConfig {
  enabled: boolean;
  discount_pct: number;      // e.g. 30 = 30% off
  weekday_end_hour: number;  // hours starting before this hour are off-peak
}

export const DEFAULT_OFFPEAK: OffPeakConfig = {
  enabled: false,
  discount_pct: 30,
  weekday_end_hour: 17,
};

export interface StudioPriceResult {
  total: number;        // what the customer pays for studio hours
  fullPrice: number;    // without any off-peak discount (paid hours only)
  discount: number;     // fullPrice - total
  paidHours: number;
  offPeakHours: number; // number of PAID hours that got the discount
}

/** Day of week for a YYYY-MM-DD string; 0 = Sunday. Date-only, so TZ-safe. */
function dayOfWeek(dateStr: string, dayOffset: number): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.getUTCDay();
}

/**
 * Price a booking hour-by-hour. The first `freeHours` hours are covered by
 * membership/credits; the remaining hours are paid, and each paid hour gets
 * the off-peak discount when it starts on a weekday before weekday_end_hour.
 */
export function computeStudioPricing(
  pricePerHour: number,
  bookingDate: string,
  startTime: string,
  durationHours: number,
  freeHours: number,
  cfg: OffPeakConfig = DEFAULT_OFFPEAK,
): StudioPriceResult {
  const startHour = parseInt(startTime.split(":")[0], 10) || 0;
  const pct = cfg.enabled ? Math.min(90, Math.max(0, cfg.discount_pct)) : 0;

  let total = 0;
  let fullPrice = 0;
  let offPeakHours = 0;
  const paidHours = Math.max(0, durationHours - Math.max(0, freeHours));

  for (let i = 0; i < durationHours; i++) {
    if (i < freeHours) continue; // covered by credits/membership
    const absHour = startHour + i;
    const dayOffset = Math.floor(absHour / 24);
    const hour = absHour % 24;
    const dow = dayOfWeek(bookingDate, dayOffset);
    const isWeekday = dow >= 1 && dow <= 5;
    const isOffPeak = pct > 0 && isWeekday && hour < cfg.weekday_end_hour;

    fullPrice += pricePerHour;
    if (isOffPeak) {
      total += pricePerHour * (1 - pct / 100);
      offPeakHours++;
    } else {
      total += pricePerHour;
    }
  }

  // Round to whole cents
  total = Math.round(total * 100) / 100;
  const discount = Math.round((fullPrice - total) * 100) / 100;

  return { total, fullPrice, discount, paidHours, offPeakHours };
}
