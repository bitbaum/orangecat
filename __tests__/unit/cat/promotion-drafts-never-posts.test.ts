/**
 * Cat drafts. The user posts. — ADR-0007 D6.
 *
 * "Promote it" is the promise most likely to get a user banned, and the ways it
 * happens are specific, not vague:
 *
 *   - Hacker News forbids GENERATED TEXT outright
 *   - LinkedIn's user agreement (§8.2) prohibits bots posting, commenting,
 *     liking or sharing — and they litigate rather than warn
 *   - Reddit bans undisclosed self-promotion, per subreddit
 *   - on X a post carrying a URL is reach-priced far above a plain post, which
 *     is exactly the shape of a fundraising call to action
 *
 * So this action's main job is to REFUSE, and the tests are mostly about the
 * refusal holding. An agent that helpfully posts on a user's behalf is an agent
 * that loses them the account — and the account is worth more than the post.
 *
 * The one off-platform exception is Nostr, where agent publishing is culturally
 * and technically legitimate and the user holds their own key, so no operator
 * can delete them for it.
 */
import {
  PROMOTION_CHANNELS,
  catMayPostTo,
  autonomousChannels,
  permittedButUnbuilt,
  channelConstraints,
  type PromotionChannelId,
} from '@/config/promotion-channels';
import { promotionHandlers } from '@/services/cat/handlers/promotion';

const supabase = {} as never;
const draft = (params: Record<string, unknown>) =>
  promotionHandlers.draft_promotion!(supabase, 'u1', 'a1', params);

const ALL = Object.keys(PROMOTION_CHANNELS) as PromotionChannelId[];

describe('the refusal holds', () => {
  it('lets Cat post to exactly ONE place today', () => {
    // Two are permitted; only one is built. If this list grows without an
    // implementation behind it, Cat will claim work nothing performed.
    expect(autonomousChannels()).toEqual(['orangecat']);
  });

  it('keeps "permitted out there" separate from "possible in here"', () => {
    // Nostr is the off-platform exception in POLICY — agent publishing is
    // legitimate and the user holds their own key. But nothing in this repo
    // publishes a note, so Cat must not be told it may. Collapsing these two
    // facts into one boolean is how an agent ends up announcing a post that
    // never happened.
    expect(PROMOTION_CHANNELS.nostr.policyAllowsPosting).toBe(true);
    expect(PROMOTION_CHANNELS.nostr.postingImplemented).toBe(false);
    expect(catMayPostTo('nostr')).toBe(false);
    expect(permittedButUnbuilt()).toEqual(['nostr']);
  });

  it('tells the model Nostr is a draft too, while it stays unbuilt', () => {
    expect(channelConstraints('nostr')).toContain('You cannot post it');
  });

  it('refuses every channel that bans or sues over automated posting', () => {
    for (const id of ['x', 'linkedin', 'reddit', 'hackernews', 'email'] as PromotionChannelId[]) {
      expect(catMayPostTo(id), id).toBe(false);
    }
  });

  it('treats an unknown channel as one Cat may not post to', () => {
    // The default must be the one that cannot cost an account.
    expect(catMayPostTo('mastodon')).toBe(false);
    expect(catMayPostTo('')).toBe(false);
    expect(catMayPostTo('__proto__')).toBe(false);
  });

  it('tells the model in words that it cannot post, per call', () => {
    return draft({ subject: 'Roof repair', channels: ['x', 'reddit'] }).then(res => {
      const data = res.data as { rule: string; draftOnly: string[]; catMayPostTo: string[] };
      expect(res.success).toBe(true);
      expect(data.catMayPostTo).toEqual([]);
      expect(data.draftOnly.sort()).toEqual(['reddit', 'x']);
      expect(data.rule).toContain('CANNOT post');
      // The specific lie to prevent: implying the work is already done.
      expect(data.rule).toContain('do not imply you have posted');
    });
  });
});

describe('the constraints are handed over, not hoped for', () => {
  it('gives Hacker News the rule that makes a finished post wrong', () => {
    // A model asked for "a Show HN post" will produce exactly what HN forbids.
    const text = channelConstraints('hackernews');
    expect(text).toContain('GENERATED TEXT');
    expect(text).toContain('DRAFT for the user to post themselves');
  });

  it("carries LinkedIn's actual prohibition, not a vague caution", () => {
    const text = channelConstraints('linkedin');
    expect(text).toContain('§8.2');
    expect(text).toMatch(/litigat/i);
  });

  it('warns that a URL in an X post is priced differently', () => {
    const text = channelConstraints('x');
    expect(text).toContain('280');
    expect(text).toMatch(/FIRST REPLY/);
  });

  it('requires disclosure where undisclosed promotion is the bannable thing', () => {
    expect(channelConstraints('reddit')).toContain('Disclosure:');
    expect(PROMOTION_CHANNELS.reddit.disclosure).toBeTruthy();
  });

  it('puts prohibitions before guidance, because the order is the priority', () => {
    const text = channelConstraints('reddit');
    expect(text.indexOf('MUST NOT')).toBeLessThan(text.indexOf(PROMOTION_CHANNELS.reddit.guidance));
  });

  it('never tells a channel it CAN post to that it is draft-only', () => {
    for (const id of autonomousChannels()) {
      expect(channelConstraints(id), id).not.toContain('DRAFT for the user');
    }
  });
});

describe('the handler is strict about what it was asked', () => {
  it('refuses with a usable message when no channel is named', async () => {
    const res = await draft({ subject: 'Roof repair' });
    expect(res.success).toBe(false);
    // The error names the options rather than just saying no.
    expect(res.error).toContain('nostr');
  });

  it('refuses when there is nothing to promote', async () => {
    const res = await draft({ channels: ['x'] });
    expect(res.success).toBe(false);
  });

  it('drops channels it does not recognise instead of inventing rules', async () => {
    const res = await draft({ subject: 'Roof repair', channels: ['x', 'myspace', 'nostr'] });
    const data = res.data as { channels: string[] };
    expect(data.channels.sort()).toEqual(['nostr', 'x']);
  });

  it('caps how many channels one call may cover', async () => {
    const res = await draft({ subject: 'Roof repair', channels: ALL });
    const data = res.data as { channels: string[] };
    expect(data.channels.length).toBeLessThanOrEqual(4);
  });

  it('accepts a comma-separated string as well as a list', async () => {
    // Models pass whichever they feel like; neither should be a failure.
    const res = await draft({ subject: 'Roof repair', channels: 'x, nostr' });
    const data = res.data as { channels: string[] };
    expect(data.channels.sort()).toEqual(['nostr', 'x']);
  });

  it('says plainly, in the user-facing line, which ones they must post', async () => {
    const res = await draft({ subject: 'Roof repair', channels: ['x'] });
    const data = res.data as { displayMessage: string };
    expect(data.displayMessage).toContain('yours to post');
  });
});

describe('every channel is fully specified', () => {
  it('has a name and guidance, so no channel is a stub', () => {
    for (const id of ALL) {
      const c = PROMOTION_CHANNELS[id];
      expect(c.name, id).toBeTruthy();
      expect(c.guidance.length, id).toBeGreaterThan(20);
      expect(c.id, id).toBe(id);
    }
  });

  it('gives every policy-forbidden channel an explicit never-post prohibition', () => {
    // The rule must be stated per channel, not inferred from a boolean, because
    // the prohibitions are what reaches the model. Scoped to the channels the
    // POLICY forbids: Nostr is draft-only for want of an implementation, not
    // because posting there would be wrong, so it carries no prohibition.
    for (const id of ALL.filter(c => !PROMOTION_CHANNELS[c].policyAllowsPosting)) {
      const joined = PROMOTION_CHANNELS[id].prohibitions.join(' ');
      expect(joined, id).toMatch(/[Nn]ever (post|send)/);
    }
  });
});
