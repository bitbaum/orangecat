/**
 * Cheap pre-filter shared by every memory extractor: does this message say
 * something about the person, or is it a transactional ask? Used by Cat's
 * memory and by companion memory — both skip the model call when it is false.
 */

/**
 * Heuristic: messages that plausibly contain durable facts about the user.
 * Transactional messages ("convert 0.1 BTC", "what's my balance") skip
 * extraction entirely.
 */
export function looksLikeSelfDisclosure(message: string): boolean {
  const m = message.toLowerCase();
  if (m.trim().length < 12) {
    return false;
  }
  return SELF_DISCLOSURE_SIGNALS.some(s => m.includes(s));
}

const SELF_DISCLOSURE_SIGNALS = [
  'i ',
  "i'm",
  'i am',
  'i prefer',
  'i like',
  'i love',
  'i hate',
  'i use',
  'i have',
  'i live',
  'i work',
  'i build',
  'i run',
  'my ',
  'me ',
  'we ',
  'our ',
  "we're",
  'remember',
  'prefer',
  'always',
  'never',
  'usually',
  'call me',
  'working on',
  'focused on',
];
