/**
 * The turn descriptor — what one turn is "about", for prompt section selection.
 *
 * config/cat-prompt-sections classifies every situational section of Cat's
 * brief with a trigger regex, matched against this string. Until now nothing
 * produced it: the flag existed, the selector existed, the tests exercised it,
 * and no caller ever passed a descriptor — so the flag was a double gate that
 * could not be flipped on. This is the producer.
 *
 * It is the user's message plus a few coarse markers the regexes already
 * expect (`first-message`, `no-specific-request`), plus the page they are on,
 * so a turn opened from a product page reaches the entity-management sections
 * even when the message itself is "make it cheaper".
 *
 * Deliberately dumb: no classification, no model call. Markers are facts the
 * caller already knows. A miss costs one situational section for one turn;
 * the core sections — every action, every rule — are never subject to this.
 */

export interface TurnDescriptorInput {
  message: string;
  /** Messages already in the conversation before this one. */
  historyLength: number;
  currentPath?: string;
  currentEntity?: { type: string; ref: string };
}

/**
 * A message that names nothing to do. Short, and made of greeting/filler words
 * only. "hi", "hello there", "hey cat" — not "hi, sell my bike".
 */
const NO_REQUEST = /^[\s\p{P}]*(hi|hello|hey|yo|hola|hallo|salut|ciao|привет|good (morning|afternoon|evening)|there|cat|you)?(\s+(hi|hello|hey|there|cat|you|again))*[\s\p{P}]*$/iu;

export function isNoSpecificRequest(message: string): boolean {
  const m = message.trim();
  return m.length === 0 || (m.length <= 24 && NO_REQUEST.test(m));
}

export function buildTurnDescriptor(input: TurnDescriptorInput): string {
  const parts: string[] = [input.message];
  if (input.historyLength === 0) {
    parts.push('first-message');
  }
  if (isNoSpecificRequest(input.message)) {
    parts.push('no-specific-request');
  }
  if (input.currentEntity?.type) {
    parts.push(`my ${input.currentEntity.type}`);
  }
  if (input.currentPath) {
    parts.push(input.currentPath);
  }
  return parts.join(' | ');
}
