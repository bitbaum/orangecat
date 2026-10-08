/**
 * The lines a companion writes for its own memory — `Method log | …`,
 * `Do not | …`, `About | …` — and the one rule for recognising them.
 *
 * Pure and dependency-free on purpose: the server stores these lines (they
 * are how a companion remembers what was tried), and the talk room hides them
 * from the person reading the reply. Both sides must agree on what a log line
 * IS, so both import it from here rather than each writing a regex.
 */

/** A line starting with one of these is a memory the companion chose to keep. */
export const STATED_MEMORY_PREFIXES = ['Method log |', 'Do not |', 'About |'] as const;

/** The line with list/quote markup removed, as the companion meant it. */
function bare(line: string): string {
  return line.replace(/^[\s>*-]+/, '').trim();
}

export function isStatedLine(line: string): boolean {
  const l = bare(line);
  return STATED_MEMORY_PREFIXES.some(p => l.startsWith(p));
}

/** Lines the companion wrote that it chose to remember, verbatim. */
export function statedMemoryLines(assistantMessage: string): string[] {
  return assistantMessage.split('\n').filter(isStatedLine).map(bare);
}

/**
 * The reply as the person should see it: the log lines are bookkeeping for
 * the companion, not part of what it says. They stay in the stored message —
 * the companion reads its own log back — and are only dropped from display.
 * A reply that is nothing BUT log lines is shown as written, never as blank.
 */
export function visibleReply(assistantMessage: string): string {
  const kept = assistantMessage.split('\n').filter(l => !isStatedLine(l));
  const text = kept.join('\n').trim();
  return text || assistantMessage;
}
