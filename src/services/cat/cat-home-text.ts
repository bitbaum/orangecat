/**
 * The small text helpers the Cat's home is written with — shared by the
 * openers (./prompt-suggestions) and the day brief (./day-brief).
 */

/** Entity titles are quoted into copy; long ones are elided. */
export const MAX_TITLE_CHARS = 40;

export const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A short, stable hash for keys built from free text (goals). */
export function fingerprint(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
