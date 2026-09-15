/**
 * "How long until this happens?" — the three shapes this interface uses.
 *
 * All three lived as a function called `formatCountdown`, in three files, each
 * printing something different: 45 seconds read as "45s", "1m" and "0:45"
 * depending on which one you happened to import. They are not one helper that
 * drifted — they are three formats that were sharing a name, which is the part
 * that made them look interchangeable. One module, three names that say what
 * they print.
 */

/**
 * Finest resolution, for a live capacity readout where seconds matter near
 * zero: 45 → "45s", 300 → "5m", 3900 → "1h 5m". `null` (nothing to count down
 * to) renders as an em dash.
 */
export function formatCountdownShort(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }
  if (seconds < 60) {
    return `${Math.max(0, Math.round(seconds))}s`;
  }
  const m = Math.floor(seconds / 60);
  if (m < 60) {
    return `${m}m`;
  }
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * Minute resolution, for a quota that resets once a day: 12240 → "3h 24m",
 * 2700 → "45m". Never prints "0m" — a reset that is seconds away still reads
 * as "1m", because "resets in 0m" reads as "already reset".
 */
export function formatCountdownCoarse(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.max(1, Math.floor((totalSeconds % 3600) / 60));
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Clock face, for a payment invoice ticking down in front of the payer:
 * 65 → "1:05".
 */
export function formatCountdownClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
