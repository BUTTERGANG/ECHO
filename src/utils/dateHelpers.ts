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

/** Monday-based start of the week ('YYYY-MM-DD') for a given date. */
export function weekStartISO(ms: number = Date.now()): string {
  const d = new Date(ms);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  return toISODate(monday.getTime());
}
