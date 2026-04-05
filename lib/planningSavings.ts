const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parses profile `quit_date` (date string or timestamptz) to epoch ms.
 * Calendar `YYYY-MM-DD` is interpreted as local midnight (matches home streak logic).
 */
export function parseQuitDateToMs(quitDate: unknown): number | null {
  if (!quitDate) return null;
  if (quitDate instanceof Date) return quitDate.getTime();
  if (typeof quitDate === "number" && Number.isFinite(quitDate)) {
    return quitDate;
  }
  if (typeof quitDate !== "string") return null;

  const match = quitDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, monthIndex, day).getTime();
  }

  const parsed = new Date(quitDate).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Habit spend from now until a future quit instant:
 * weekly_spend × (weeks from now until quit_date).
 */
export function projectedSpendUntilQuitDate(
  weeklySpend: number,
  quitMs: number,
  nowMs: number = Date.now()
): number {
  if (!Number.isFinite(weeklySpend) || weeklySpend < 0) return 0;
  if (!Number.isFinite(quitMs)) return 0;
  const msUntil = quitMs - nowMs;
  if (msUntil <= 0) return 0;
  return weeklySpend * (msUntil / WEEK_MS);
}
