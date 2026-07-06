/** Date helpers: ISO formatting and week boundaries (handoff §7). */

/** 'YYYY-MM-DD' in local time for a given epoch-ms (defaults to now). */
export function toISODate(ms: number = Date.now()): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate();
}

/** Number of whole local days between two epoch-ms values (a - b). */
export function dayDiff(aMs: number, bMs: number): number {
  const a = new Date(aMs);
  const b = new Date(bMs);
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aMid - bMid) / 86_400_000);
}

/**
 * Fractional age in years from a date-of-birth epoch-ms (e.g. 28.4). `nowMs` is
 * a parameter so callers can pass a value read in an effect, keeping render pure.
 */
export function preciseAgeYears(dobMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, (nowMs - dobMs) / (365.2425 * 86_400_000));
}

/** Whole local days elapsed since an epoch-ms (0 if it's in the future). */
export function daysSince(ms: number, nowMs: number = Date.now()): number {
  return Math.max(0, dayDiff(nowMs, ms));
}

/** Monday-based start of the week ('YYYY-MM-DD') for a given date. */
export function weekStartISO(ms: number = Date.now()): string {
  const d = new Date(ms);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  return toISODate(monday.getTime());
}
