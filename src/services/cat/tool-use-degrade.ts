/**
 * What the tool phase says when it could not finish.
 *
 * Extracted from `tool-use.ts` as one cohesive thing: the notes and the fallback
 * are a single decision — how Cat behaves when a lookup was STARTED and did not
 * land. That is the third answer in the shape this codebase keeps returning to.
 * Got it, found nothing, and could not look are three different facts, and only
 * the last one is invisible unless something says it out loud.
 *
 * The failure being prevented is specific: told nothing, the main model answers
 * from its weights, and the user cannot tell that apart from a researched
 * answer. It is the worst of the three outcomes precisely because it is the
 * only one that looks fine.
 */
import { hasWebsiteAnalysisIntent } from './tool-use-detection';
import type { ToolAugmentedMessage } from './tool-use-types';

/**
 * When the tool phase fails or times out on a message that wanted a website
 * read, the main model must NOT guess the site's content — it gets this note
 * so it can tell the user honestly what happened.
 */
export const WEBSITE_FETCH_FAILED_NOTE =
  "NOTE: The user's message contains a website URL, but the site could not be fetched " +
  '(the tool step failed or timed out). Tell the user plainly that you could not reach ' +
  'the site right now and ask them to check the URL or try again — do NOT guess, ' +
  "describe, or invent the site's content.";

/**
 * When the tool phase dies mid-research, the main model is holding a question
 * it was about to look up.
 */
export const WEB_RESEARCH_FAILED_NOTE =
  'NOTE: A web lookup was started for this message and did not finish (the tool step failed ' +
  'or timed out). You have NOT seen any web content. Answer from what you already know, say ' +
  'plainly that you could not check the web just now, and do NOT state current prices, dates, ' +
  'availability or any other fact that would have needed that lookup.';

/** What the tool phase falls back to when it fails or times out. */
export function degradedMessages(
  messages: ToolAugmentedMessage[],
  userMessage: string,
  usedWeb = false
): ToolAugmentedMessage[] {
  if (hasWebsiteAnalysisIntent(userMessage)) {
    return [...messages, { role: 'system', content: WEBSITE_FETCH_FAILED_NOTE }];
  }
  if (usedWeb) {
    return [...messages, { role: 'system', content: WEB_RESEARCH_FAILED_NOTE }];
  }
  return messages;
}
