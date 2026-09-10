/**
 * Per-turn reply-language directive.
 *
 * Why this exists: the system prompt already says "reply in the language of the
 * user's latest message," but the weak free models (e.g. GPT-OSS-120B) ignore a
 * rule buried mid-prompt and default to the browser *locale's* language — so a
 * German-locale user who types English gets a German answer. The robust fix is
 * to (a) detect the message language deterministically server-side and (b) inject
 * a short, unambiguous imperative at the very END of the prompt, where even weak
 * models weight instructions most. Recency + specificity beats a buried rule.
 *
 * Scope: English vs German — the two languages actually in play on the platform
 * (German-locale browsers are the reported failure). For anything else we fall
 * back to a generic "match the user's language" reminder rather than guess wrong.
 */

// Whole-word stopword signals. Short, high-frequency, and disjoint between the
// two languages so even a 3-word message ("friends and friends") scores cleanly.
const GERMAN_WORDS = new Set([
  'ich',
  'du',
  'der',
  'die',
  'das',
  'und',
  'ist',
  'nicht',
  'ein',
  'eine',
  'mit',
  'für',
  'auf',
  'auch',
  'wie',
  'was',
  'wer',
  'wir',
  'ihr',
  'sie',
  'mein',
  'kein',
  'möchte',
  'machen',
  'haben',
  'sein',
  'wochenende',
  'ja',
  'nein',
  'danke',
  'bitte',
  'oder',
  'aber',
  'schon',
  'noch',
  'sehr',
  'gut',
]);

const ENGLISH_WORDS = new Set([
  // Standalone "i" is an unambiguous English signal — German has no bare "i"
  // (it uses "ich"), so it safely tags openers like "I'm a dj". (Not "im" —
  // that's the German word "in dem".)
  'i',
  'the',
  'and',
  'is',
  'are',
  'you',
  'your',
  'want',
  'wanna',
  'with',
  'for',
  'just',
  'now',
  'but',
  'not',
  'this',
  'that',
  'have',
  'do',
  'does',
  'my',
  'me',
  'we',
  'they',
  'friends',
  'weekend',
  'weekends',
  'yes',
  'no',
  'please',
  'thanks',
  'how',
  'what',
  'who',
  'looking',
  'make',
  'play',
]);

export type ReplyLanguage = 'en' | 'de' | 'unknown';

/**
 * Best-effort language guess for a single user message. Deterministic, no deps.
 */
export function detectReplyLanguage(message: string): ReplyLanguage {
  const text = message.toLowerCase();

  // Umlauts / ß are a strong, unambiguous German signal.
  const hasGermanChars = /[äöüß]/.test(text);

  const words = text.split(/[^a-zäöüß]+/i).filter(Boolean);
  let de = 0;
  let en = 0;
  for (const w of words) {
    if (GERMAN_WORDS.has(w)) {
      de++;
    }
    if (ENGLISH_WORDS.has(w)) {
      en++;
    }
  }

  // Umlauts / ß are a strong German signal — but ONLY when the words around
  // them don't clearly say otherwise. Swiss place names ("Zürich", "Männedorf")
  // appear constantly inside English sentences ("I offer haircuts in Zürich"),
  // and the old unconditional +2 made one umlaut outvote the actual English
  // words, so English messages got German answers. Count the umlaut bump only
  // when there's corroborating German vocabulary or no English signal at all.
  if (hasGermanChars && (de > 0 || en === 0)) {
    de += 2;
  }

  if (de > en && de > 0) {
    return 'de';
  }
  if (en > de && en > 0) {
    return 'en';
  }
  return 'unknown';
}

const LANG_NAME: Record<Exclude<ReplyLanguage, 'unknown'>, string> = {
  en: 'English',
  de: 'German (Deutsch)',
};

/**
 * Hard, final-position language directive appended to the system prompt for THIS
 * turn. Returns a confident, named instruction when the message is clearly en/de;
 * otherwise a generic recency reminder that still forbids defaulting to the locale.
 */
/**
 * Scripts the stopword lists cannot see. A Russian or Ukrainian message has
 * ZERO English and ZERO German stopwords, so it used to fall through to the
 * "unknown" branch — whose last sentence was "If the user wrote English,
 * reply in English", the strongest recency signal a weak model reads. That
 * is how a Russian conversation got English words and English chips.
 */
export function detectScript(message: string): 'cyrillic' | 'latin' | 'other' {
  if (/[\u0400-\u04FF]/.test(message)) {
    return 'cyrillic';
  }
  if (/[a-z]/i.test(message)) {
    return 'latin';
  }
  return 'other';
}

const EVERY_PART = 'every sentence, every quick_replies chip, every button label';

export function buildReplyLanguageDirective(message: string): string {
  const lang = detectReplyLanguage(message);
  if (lang !== 'unknown') {
    return `\n\n## Reply language (this turn — obey exactly)\nThe user's latest message is in ${LANG_NAME[lang]}. Write your ENTIRE reply in ${LANG_NAME[lang]} — ${EVERY_PART}. Ignore the browser locale for language choice; it only sets number/date/currency formatting.`;
  }
  if (detectScript(message) === 'cyrillic') {
    return `\n\n## Reply language (this turn — obey exactly)\nThe user's latest message is written in Cyrillic (Russian or Ukrainian — match which). Write your ENTIRE reply in that same language — ${EVERY_PART}. Do not mix in English words where the language has its own; only product names (OrangeCat, FleetCrown, Bitcoin) stay as they are.`;
  }
  return `\n\n## Reply language (this turn — obey exactly)\nWrite your ENTIRE reply in the SAME language as the user's latest message above — ${EVERY_PART}. Do NOT switch to the browser locale's language and do NOT default to English.`;
}
