/**
 * Cat tool-use intent detection + tool definitions. Extracted verbatim from
 * tool-use.ts (SoC). messageMightNeedTools is re-exported from tool-use.ts.
 */

import { extractHttpUrls, isUrlOnlyMessage } from './website-analysis';

/**
 * Cheap pre-filter to decide whether the user message MIGHT need a tool call.
 * If none of these keywords appear, we skip the extra Groq tool-pass entirely
 * to keep the cost / latency floor low. Both discovery-style and creation-style
 * intents are covered.
 */
const TOOL_TRIGGER_KEYWORDS = [
  // discovery / search_platform
  'find',
  'look',
  'search',
  'who ',
  'anyone',
  'connect',
  'similar',
  'recommend',
  'discover',
  'help me find',
  'know of',
  'looking for',
  'does anyone',
  // creation / prefill_entity_form
  'want to sell',
  'want to offer',
  'want to start',
  'want to create',
  'want to launch',
  "i'd like to sell",
  "i'd like to offer",
  "i'd like to create",
  "i'd like to start",
  'create a',
  'launch a',
  'set up a',
  'set up an',
  'open a',
  'open an',
  'i sell',
  'i make',
  'i provide',
  'i offer',
  'i run',
  'i teach',
  'i organize',
  'i need to raise',
  'fundraise',
  // economic-agent / suggest_offers ("what can I offer?")
  'what can i offer',
  'what can i sell',
  'what could i offer',
  'what should i create',
  'what should i sell',
  'make money',
  'earn money',
  'monetize',
  'monetise',
  'ways to earn',
  'help me make money',
  'what can i do to earn',
  'ideas for me',
  'how can i participate',
  // platform health / notifications / check_cat_health
  'notification',
  'diagnose',
  'health check',
  'not answering',
  'not working',
  'not responding',
  'eval',
  'harness',
  // interest / topic discovery — explore_topic. Without these, "I'm interested
  // in longevity" matches NO keyword and the tool pass never runs, so the whole
  // discovery capability stays unreachable.
  'interested in',
  'interest in',
  "i'm into",
  'im into',
  'passionate about',
  'care about',
  'curious about',
  'tell me about',
  'what is happening with',
  "what's happening with",
  'learn about',
  'explore',
  'anything about',
  'anyone working on',
  'who else is',
  'get involved',
  'put me in touch',
  'introduce me',
  'introduction to',
  'reach out to',
  // the user's own follow graph — search_platform/explore_topic scope
  // "following", and person_posts / following_topic watches
  'i follow',
  "i'm following",
  'im following',
  'my follows',
  'my network',
  'watch her',
  'watch his',
  'watch their',
  'when she posts',
  'when he posts',
  'when they post',
  // read surface / query_my_data ("how am I doing?")
  'how much',
  'earning',
  'earned',
  'revenue',
  'income',
  'sales',
  'sold',
  'balance',
  'my wallet',
  'my listings',
  'my products',
  'my services',
  'my projects',
  'my causes',
  'my events',
  'my bookings',
  'my tasks',
  'my drafts',
  'my stats',
  'unread',
  'overview',
  'summary of my',
  'status update',
  'what do i have',
  'show me my',
  'catch me up',
];

/**
 * Whether a message looks like a discovery / creation / multi-step task — the
 * kind that benefits from an agentic (frontier) model and triggers the tool
 * pass. Exported so the chat route can decide whether to nudge a user on a
 * weaker model toward upgrading, using the SAME signal that gates tool use
 * (one source of truth for "this wants more than chat").
 */
/**
 * A money NEED ("I need 500 CHF to fix my bike", "can I borrow money here?")
 * is a lending/funding intent — it should reach the tool pass so Cat can draft
 * a loan (or project/cause) instead of only suggesting things to sell.
 * Deliberately narrow: "need" alone never triggers; it must pair with an
 * amount+currency or an explicit borrow/loan word.
 */
const MONEY_NEED_PATTERNS = [
  /\bborrow\b/i,
  /\b(a|get|request|take)\s+(out\s+)?a?\s*loan\b/i,
  /\bneed\s+(some\s+)?(money|cash|funds|capital)\b/i,
  /\bneed\s+[\d'.,]+\s*(chf|eur|usd|btc|francs?|dollars?|euros?)\b/i,
];

export function hasMoneyNeedIntent(message: string): boolean {
  return MONEY_NEED_PATTERNS.some(re => re.test(message));
}

/**
 * Every trigger above is an English (or German) word. A message in Cyrillic,
 * Greek, Arabic, Hebrew, Devanagari, CJK or Hangul matched nothing, so the
 * tool phase never ran for it — no prefill cards, no search, no action tools —
 * and the user got prose about the product instead of the product. A message
 * with enough non-Latin letters to be a sentence goes to the (cheap) routing
 * step, which decides whether a tool is actually needed.
 */
const NON_LATIN_LETTERS =
  /[\u0370-\u03FF\u0400-\u04FF\u0590-\u08FF\u0900-\u0DFF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g;
const NON_LATIN_SENTENCE_MIN_LETTERS = 12;

export function hasNonLatinSentence(message: string): boolean {
  return (message.match(NON_LATIN_LETTERS) ?? []).length >= NON_LATIN_SENTENCE_MIN_LETTERS;
}

export function messageMightNeedTools(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    TOOL_TRIGGER_KEYWORDS.some(kw => lower.includes(kw)) ||
    hasMoneyNeedIntent(message) ||
    hasWebsiteAnalysisIntent(message) ||
    hasNonLatinSentence(message)
  );
}

/**
 * Intent words that, TOGETHER with a pasted URL, signal "read my site and act
 * on it" (analyze_website). A URL pasted casually MID-SENTENCE doesn't trigger
 * the tool pass on its own — but a URL plus any of these does. A message that
 * is ONLY a URL/domain always triggers (see hasWebsiteAnalysisIntent).
 */
const URL_ANALYZE_INTENT_KEYWORDS = [
  'set me up',
  'set us up',
  'set it up',
  'my site',
  'my website',
  'my webpage',
  'my homepage',
  'my business',
  'my shop',
  'my store',
  'my page',
  'my company',
  'our site',
  'our website',
  'our business',
  'this site',
  'this website',
  'the site',
  'the website',
  'analyze',
  'analyse',
  'import',
  'onboard',
  'check out',
  'take a look',
  'have a look',
  'look at',
  'read it',
  'read my',
  'from my',
  'based on',
];

/**
 * The message wants the Cat to actually READ a site (analyze_website), not
 * just chat about it. True when either:
 * - the message IS a URL/domain and nothing else ("revampit.orangecat.ch" —
 *   the only plausible intent is "analyze this site and set me up"), or
 * - a pasted URL appears together with setup/analyze/import intent words.
 */
export function hasWebsiteAnalysisIntent(message: string): boolean {
  if (extractHttpUrls(message).length === 0) {
    return false;
  }
  if (isUrlOnlyMessage(message)) {
    return true;
  }
  const lower = message.toLowerCase();
  return URL_ANALYZE_INTENT_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Strong "I want to create/list my own thing" signals. When present we
 * PROGRAMMATICALLY suppress search_platform tool calls — the weak free-tier
 * models ignore the routing prompt and search anyway, wasting a round-trip and
 * surfacing irrelevant "results" on a pure create intent. prefill_entity_form
 * is still allowed through.
 */
const CREATE_INTENT_PATTERNS = [
  /\b(i|we)\s+(make|sell|offer|provide|run|teach|organi[sz]e|build|create|craft|bake|design)\b/i,
  /\bwant(ed)?\s+to\s+(sell|offer|start|create|launch|list|build|make|raise|fundraise)\b/i,
  /\b(i'?d|i\s+would)\s+like\s+to\s+(sell|offer|create|start|launch|list)\b/i,
  /\b(create|launch|set\s+up|open|list|start)\s+(a|an|my)\b/i,
  /\bi\s+need\s+to\s+raise\b/i,
];

export function hasCreateIntent(message: string): boolean {
  // A money need drafts the user's OWN loan/project — a create intent, never a
  // platform search.
  return CREATE_INTENT_PATTERNS.some(re => re.test(message)) || hasMoneyNeedIntent(message);
}

// Tool DEFINITIONS live in ./platform-tool-definitions (file-size limit);
// re-exported so existing importers keep one path.
export { PLATFORM_TOOL_DEFINITION, PREFILLABLE_ENTITY_TYPES } from './platform-tool-definitions';
