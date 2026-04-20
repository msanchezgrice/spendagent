import type { NormalizedUsage, UsageRecord } from "../types.js";

export function normalizeUsage(records: UsageRecord[]): NormalizedUsage {
  let min: string | undefined;
  let max: string | undefined;
  for (const r of records) {
    if (!r.timestamp) continue;
    if (!min || r.timestamp < min) min = r.timestamp;
    if (!max || r.timestamp > max) max = r.timestamp;
  }

  let days = 30;
  if (min && max) {
    const d0 = new Date(min).getTime();
    const d1 = new Date(max).getTime();
    if (!Number.isNaN(d0) && !Number.isNaN(d1) && d1 >= d0) {
      days = Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
    }
  }

  return {
    generated_at: new Date().toISOString(),
    days_covered: days,
    min_date: min,
    max_date: max,
    records,
  };
}
