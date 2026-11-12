/**
 * Where a turn's time went, in named phases.
 *
 * A bot took a long time to answer "Hi" and nothing said which step was
 * slow. Each mark closes the phase since the previous one; the report is the
 * milliseconds per phase and the total, logged once per turn.
 */
export interface TurnTimer {
  /** Close the phase that started at the previous mark (or at the start). */
  mark(phase: string): void;
  /** Milliseconds since the turn began, now. */
  elapsedMs(): number;
  /** `{ <phase>Ms, …, totalMs }`. A phase marked twice is summed. */
  report(): Record<string, number>;
}

export function turnTimer(now: () => number = () => performance.now()): TurnTimer {
  const start = now();
  let last = start;
  const phases = new Map<string, number>();
  return {
    mark(phase) {
      const t = now();
      phases.set(phase, (phases.get(phase) ?? 0) + (t - last));
      last = t;
    },
    elapsedMs() {
      return now() - start;
    },
    report() {
      const out: Record<string, number> = {};
      for (const [phase, ms] of phases) {
        out[`${phase}Ms`] = Math.round(ms);
      }
      out.totalMs = Math.round(last - start);
      return out;
    },
  };
}
