/**
 * PROMPT SECTION BUDGET — which parts of Cat's brief every message pays for.
 *
 * Cat's static prompt is ~54,000 characters, and Groq's on-demand tier admits
 * about 41,000 once output and the user's own context are reserved. Cutting the
 * difference by editing is not available: there is no duplication left, and
 * every remaining rule ("never open with a list of questions", crisis handling,
 * "never pigeonhole") is there because Cat got something wrong without it.
 *
 * The waste is not in the words, it is in sending ALL of them EVERY time. A
 * message about pricing a mug currently pays for crisis handling, setting up
 * for someone else,
 * notification triage and multi-entity strategy. So sections are classified:
 *
 *   CORE        — always sent. Capability, safety, and output contracts:
 *                 anything whose absence makes Cat unable or unsafe rather
 *                 than merely less sharp.
 *   SITUATIONAL — sent when the turn is plausibly about it.
 *
 * ── The line between the two is deliberate ──────────────────────────────────
 * A missing SITUATIONAL section costs sharpness: Cat still has every action,
 * tool and response format, it is just less coached on that topic. A missing
 * CORE section costs capability or safety — an action becomes unemittable, a
 * response format malformed, or a person in crisis gets a sales pitch. The
 * first is a degradation; the second is a defect. So when a section is
 * arguable, it goes in CORE.
 *
 * That is why `When Someone Needs Help, Not Strategy` and `Never Pigeonhole`
 * are CORE despite reading as situational: the cost of missing them lands on a
 * person having a bad day, not on a metric.
 *
 * Selection is keyword-based and deliberately GENEROUS — a false include costs
 * a few hundred characters, a false exclude costs behaviour. When in doubt the
 * matcher fires.
 */

/**
 * Sections every message pays for. Keys are the exact `## ` heading text.
 * `assertEveryPromptSectionClassified` fails the build if a heading here drifts.
 */
export const CORE_SECTIONS: readonly string[] = [
  'Your Purpose',
  'Current Session Awareness',
  'Grounding & Honesty (non-negotiable)',
  'How to Think About Users',
  "How to Respond — be useful fast, don't interrogate",
  'When Someone Needs Help, Not Strategy',
  'Never Pigeonhole',
  'Using Context',
  'Tappable Answers (quick replies)',
  'Response Format for Entity Suggestions',
  'Response Format for Entity Updates',
  'Response Format for Wallet Suggestions',
  'Actions You Can Execute Directly',
  'Platform Discovery (search_platform tool)',
  'Tools You Can Call',
  'Critical Rules',
];

/**
 * Sections sent only when the turn looks related. The regex is matched against
 * the user's message plus a coarse turn descriptor (e.g. "first-message"), all
 * lowercased.
 */
export const SITUATIONAL_SECTIONS: ReadonlyArray<{ heading: string; when: RegExp }> = [
  {
    heading: 'Presenting Platform Search / Matchmaking Results',
    when: /search|find|who else|anyone|introduce|connect|discover|match|looking for|interested in/,
  },
  {
    heading: 'Drawing out what they can offer (when their Economic Profile is thin)',
    when: /offer|sell|skill|good at|make money|earn|idea|what can i|help me start|first-message|thin-profile/,
  },
  { heading: 'Orienting a New Person (first reply)', when: /first-message/ },
  {
    heading: 'Setting Up for Someone Else',
    // Cyrillic on purpose: the two conversations that motivated this section
    // were in Russian ("не для меня", "для другого пользователя", "не зарегистрирован").
    when: /my friend|my mother|my father|my sister|my brother|someone i know|on behalf|for a friend|helping someone|for another|another user|not for me|isn't registered|not registered|for her|for him|друг|подруг|для (него|неё|нее|другого|другой)|не для меня|не зарегистрирован|fleetcrown|fleet crown/,
  },
  {
    heading: 'Choosing the Entity Type (decision rubric — apply before EVERY proposal)',
    when: /sell|offer|create|list|start|fund|raise|loan|borrow|rent|event|cause|project|product|service|make money|earn/,
  },
  {
    heading: 'Economic Building Blocks',
    when: /sell|offer|create|list|start|fund|raise|loan|borrow|invest|rent|asset|wishlist|research|event|cause|project|product|service|earn|money/,
  },
  {
    heading: 'Multi-Entity Strategies',
    when: /strategy|combine|both|multiple|also|as well|scale|grow|expand|next step|what else/,
  },
  {
    heading: 'Managing Existing Entities',
    when: /update|edit|change|publish|unpublish|archive|delete|remove|draft|my product|my service|my project|my cause|live|status/,
  },
  {
    heading: 'Pricing Guidance',
    when: /price|pricing|charge|cost|how much|worth|rate|fee|expensive|cheap/,
  },
  {
    heading: 'Helping With Notifications (assistance scope)',
    when: /notification|alert|message|unread|inbox|why did i get|what does this mean|health|error|failing|not working|slow/,
  },
  {
    heading: 'Opening a Conversation',
    when: /first-message|no-specific-request|hi|hello|hey|what's up|catch me up|what should i|anything new/,
  },
];

/** Every heading, for the drift guard. */
export const CLASSIFIED_SECTION_HEADINGS: readonly string[] = [
  ...CORE_SECTIONS,
  ...SITUATIONAL_SECTIONS.map(s => s.heading),
];

/**
 * Which sections this turn should carry. Returns headings, in no order — the
 * caller preserves the prompt's own ordering so the brief still reads as one
 * document.
 */
export function selectPromptSections(turnDescriptor: string): Set<string> {
  const haystack = turnDescriptor.toLowerCase();
  const chosen = new Set<string>(CORE_SECTIONS);
  for (const { heading, when } of SITUATIONAL_SECTIONS) {
    if (when.test(haystack)) {
      chosen.add(heading);
    }
  }
  return chosen;
}
