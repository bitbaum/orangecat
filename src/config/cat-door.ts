/**
 * The one query parameter that hands a sentence to the Cat.
 *
 * `/dashboard/cat?q=…` auto-sends the sentence into an empty conversation
 * (ModernChatPanel). The door, the profile's "ask about this" links and the
 * map all build that URL; this is the parameter's only spelling.
 */
export const CAT_QUERY_PARAM = 'q';

/** The sentences the door offers as examples — real things it can do today. */
export const DOOR_EXAMPLES = [
  'Sell my old bike',
  'Raise money for the school roof',
  'Lend a friend 500 for two months',
  'Start a fund for Witikon',
  'Throw a party on Saturday',
] as const;

/** Shared copy and constraints for native and chatkit intent entry. */
export const CAT_DOOR = {
  prompt: 'What do you want to do?',
  placeholder: 'Describe what you want to do…',
  submit: 'Ask Cat',
  minLength: 3,
  maxLength: 500,
} as const;

/** Where the Cat lives; the door sends a sentence there. Spelled as ROUTES.DASHBOARD.CAT. */
const CAT_PATH = '/dashboard/cat';

/** The Cat, with a sentence already asked. */
export function catHrefWithSentence(sentence: string): string {
  return `${CAT_PATH}?${CAT_QUERY_PARAM}=${encodeURIComponent(sentence)}`;
}

/**
 * The register form for a visitor who already typed something: after sign-up
 * they land on the Cat with that sentence asked, so nothing typed is lost.
 */
export function registerHrefKeepingSentence(sentence: string): string {
  return `/auth?mode=register&from=${encodeURIComponent(catHrefWithSentence(sentence))}`;
}

/**
 * The sentence a return path carries to the Cat, or null. The account screen
 * shows it, so the visitor sees their words were kept (they used to survive
 * only inside `from=`, which nobody reads).
 */
export function sentenceFromReturnPath(from: string | null | undefined): string | null {
  if (!from || !from.startsWith(`${CAT_PATH}?`)) {
    return null;
  }
  const sentence = new URLSearchParams(from.slice(CAT_PATH.length + 1)).get(CAT_QUERY_PARAM);
  return sentence?.trim() ? sentence.trim().slice(0, CAT_DOOR.maxLength) : null;
}
