/**
 * Where a project can be promoted, and what each place will ban you for.
 *
 * ADR-0007 D6. "Promote it" is the promise most likely to get a user banned, so
 * the knowledge that prevents that lives here rather than in a prompt: a model
 * asked to "write a Show HN post" will happily produce the exact thing Hacker
 * News forbids, and the user carries the consequence.
 *
 * The invariant is one sentence: **Cat drafts, the user posts** — with a single
 * off-platform exception, Nostr, where autonomous publishing by an agent is
 * both culturally and technically legitimate (NIP-99 classified listings,
 * NIP-57 zaps, NIP-75 zap goals).
 *
 * A refusal is the feature. An agent that cheerfully posts on a user's behalf
 * is an agent that gets the user's account deleted — and the account is worth
 * more than the post.
 *
 * `prohibitions` are not style notes. Each is a rule that, broken, costs the
 * user their account or their money, and each is stated so it can be handed to
 * the model as a constraint rather than a hope.
 */

export type PromotionChannelId =
  'orangecat' | 'nostr' | 'x' | 'linkedin' | 'reddit' | 'hackernews' | 'email';

export interface PromotionChannel {
  id: PromotionChannelId;
  name: string;
  /**
   * May Cat publish here WITHOUT the user pressing send?
   *
   * True for exactly two: the user's own OrangeCat timeline, which is this
   * platform's own surface and already behind the permission ladder, and
   * Nostr. Everywhere else this is false and must stay false.
   */
  catMayPost: boolean;
  /** Hard length limit, where the platform has one worth respecting. */
  maxChars?: number;
  /** What gets the user banned, sued, or billed. */
  prohibitions: readonly string[];
  /** Disclosure the platform requires of automated or promotional content. */
  disclosure?: string;
  /** How to write something that actually works there. */
  guidance: string;
}

export const PROMOTION_CHANNELS: Record<PromotionChannelId, PromotionChannel> = {
  orangecat: {
    id: 'orangecat',
    name: 'Your OrangeCat timeline',
    // Our own surface, and already gated by the permission ladder and the
    // confirmation flow like any other action.
    catMayPost: true,
    prohibitions: [],
    guidance:
      'Say what the project is for and what the money does. The audience already ' +
      'understands funding, so skip the explanation of what a project is.',
  },

  nostr: {
    id: 'nostr',
    name: 'Nostr',
    // The one off-platform exception. Agents publishing is normal here, the
    // user holds their own key, and no operator can delete the account for it.
    catMayPost: true,
    prohibitions: [],
    guidance:
      'A zap goal (NIP-75) or classified listing (NIP-99) carries the ask better ' +
      'than prose. Plain text, no engagement bait, and the lightning address ' +
      'belongs in the note so a zap needs no extra step.',
  },

  x: {
    id: 'x',
    name: 'X',
    catMayPost: false,
    maxChars: 280,
    prohibitions: [
      "Never post on the user's behalf — drafts only.",
      'A post containing a URL is reach-priced far above a plain post, which is ' +
        'exactly the shape of a fundraising call to action.',
    ],
    guidance:
      'Put the hook in the post and the link in the FIRST REPLY. One concrete ' +
      'number beats an adjective.',
  },

  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    catMayPost: false,
    prohibitions: [
      "Never post, comment, like or share on the user's behalf. The user " +
        'agreement (§8.2) prohibits bots doing any of those, and LinkedIn ' +
        'litigates rather than warns.',
    ],
    guidance:
      'Lead with the problem and who it is for. The audience is colleagues, so ' +
      'credibility reads better than enthusiasm.',
  },

  reddit: {
    id: 'reddit',
    name: 'Reddit',
    catMayPost: false,
    prohibitions: [
      "Never post on the user's behalf — drafts only.",
      'Rules are PER SUBREDDIT, and self-promotion is banned outright in many. ' +
        'The user must check the specific subreddit before posting.',
    ],
    disclosure:
      'Disclose the connection to the project plainly — undisclosed self-promotion ' +
      'is what gets accounts banned here.',
    guidance:
      'Write for the specific subreddit, not for Reddit. Answer the question the ' +
      'community actually discusses, and mention the project as context.',
  },

  hackernews: {
    id: 'hackernews',
    name: 'Hacker News',
    catMayPost: false,
    prohibitions: [
      "Never post on the user's behalf — drafts only.",
      'The guidelines forbid GENERATED TEXT outright. Do not hand the user a ' +
        'post to paste; offer angles and let them write it in their own words.',
    ],
    guidance:
      'Suggest what is genuinely interesting or technically unusual about the ' +
      'project, as bullet points for the user to write from — not a finished post.',
  },

  email: {
    id: 'email',
    name: 'Email to someone specific',
    catMayPost: false,
    prohibitions: [
      "Never send on the user's behalf — drafts only.",
      'One named recipient at a time. A list is a mailing, and a mailing without ' +
        'consent is spam.',
    ],
    guidance:
      'Say why THIS person, in the first line. A mail that could have gone to ' +
      'anyone reads as a mailing and is treated as one.',
  },
};

/**
 * May Cat publish here on its own?
 *
 * The default is NO for anything unrecognised, which is the answer that cannot
 * get an account deleted.
 */
export function catMayPostTo(channel: string): boolean {
  return PROMOTION_CHANNELS[channel as PromotionChannelId]?.catMayPost === true;
}

/** Channels Cat may publish to autonomously. Deliberately short. */
export function autonomousChannels(): PromotionChannelId[] {
  return (Object.keys(PROMOTION_CHANNELS) as PromotionChannelId[]).filter(id => catMayPostTo(id));
}

/**
 * The constraints for one channel, as text a model can be held to.
 *
 * Prohibitions first and disclosure before guidance, because the order is the
 * priority: what must not happen outranks what would read well.
 */
export function channelConstraints(channel: PromotionChannelId): string {
  const c = PROMOTION_CHANNELS[channel];
  const lines = [`${c.name}:`];
  if (c.maxChars) {
    lines.push(`- Hard limit ${c.maxChars} characters.`);
  }
  for (const p of c.prohibitions) {
    lines.push(`- MUST NOT: ${p}`);
  }
  if (c.disclosure) {
    lines.push(`- Disclosure: ${c.disclosure}`);
  }
  lines.push(`- ${c.guidance}`);
  if (!c.catMayPost) {
    lines.push('- This is a DRAFT for the user to post themselves. You cannot post it.');
  }
  return lines.join('\n');
}
