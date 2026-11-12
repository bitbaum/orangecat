/**
 * CAT HOME — what the Cat brings up before the user types anything.
 *
 * Contract and history: @/config/cat-prompts. In short, the empty chat is the
 * Cat's turn: it opens with something it noticed, in its own voice, and offers
 * the one or two replies that act on it.
 *
 *   1. OPENERS are deterministic reads of the user's state, ranked by
 *      TIMELINESS first (a sale, a booking, an overdue task, unread
 *      notifications, a stated goal) and only then by consequence (the gaps:
 *      can't get paid > invisible drafts > unreadable/unbuyable listings > no
 *      bio > demand). The old engine had only the gaps, pinned the worst one
 *      forever, and so headlined a test draft on every visit. Now:
 *        - test/placeholder drafts are not the Cat's business;
 *        - several drafts are ONE opener about the pile, not a spotlight on
 *          whichever happened to sort first;
 *        - every opener has a stable key, and the client skips dismissed keys,
 *          so "not now" moves the Cat on.
 *   2. The DAY BRIEF leads them: one opener that counts everything waiting
 *      on the person right now (Loki, bookings, tasks, messages,
 *      notifications) and offers the reply that fits the hour. A home that
 *      showed one fact and three detached questions looked the same every
 *      visit and read like a form (owner, 2026-11-12). It is keyed on the
 *      day, the part of day and what it says, so it is new every morning and
 *      returns after a dismissal the moment something changes.
 *   3. CHIPS are what this person might ask next: the most timely fact's
 *      reply, then the standing topics (goal, gaps) in an order that turns
 *      with the calendar day, then the registry-derived starters.
 *
 * No model call. The chips used to be written by the platform LLM on every
 * open of an empty chat — a free-tier spend on page load, before the person
 * had asked anything. Standing rule (2026-09-25): a free-tier key is spent
 * only when a person deliberately asks, and opening the chat is not asking.
 */

import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import {
  CAT_HOME_MAX_CHIPS,
  STARTER_HOME,
  getStarterChips,
  type CatHome,
  type CatOpener,
  type CatReference,
} from '@/config/cat-prompts';
import { APP_LOCALE } from '@/utils/locale';
import { isValidTimeZone } from '@/utils/timezone';
import { composeDayBrief, localClock } from './day-brief';
import { MAX_TITLE_CHARS, fingerprint, plural, truncate } from './cat-home-text';
import type { EntitySummary, FullUserContext } from '@/services/ai/document-context-types';

/** Openers held in reserve behind the one shown, so dismissing has somewhere to go. */
const MAX_OPENERS = 6;

/** Items offered in the composer's "+" menu. */
const MAX_ATTACHABLE = 20;

/**
 * Returns true when the user has enough context for the Cat to say something
 * specific. Below this bar there is nothing to ground an opener in.
 */
export function hasRichContext(context: FullUserContext): boolean {
  return (
    !!(context.profile?.name || context.profile?.bio || context.profile?.background) ||
    context.entities.length > 0 ||
    context.documents.length > 0 ||
    context.tasks.length > 0 ||
    context.wallets.length > 0
  );
}

// ─── Entity predicates ────────────────────────────────────────────────────────

const isDraft = (e: EntitySummary): boolean => e.status?.toLowerCase() === 'draft';

/**
 * A title that says the thing was never meant for anyone: "Test Service",
 * "Untitled", "asdf". Spotlighting one of these as the most important thing
 * in someone's life is what made the old empty state feel robotic.
 */
export const isPlaceholderTitle = (title: string): boolean =>
  /\b(test(ing)?|demo|sample|example|untitled|placeholder|dummy|asdf|foo|lorem)\b/i.test(title);

const registryFor = (e: EntitySummary) =>
  ENTITY_REGISTRY[e.type as EntityType] as (typeof ENTITY_REGISTRY)[EntityType] | undefined;

/** True when this entity type is bought at a price, so a missing price blocks a sale. */
const isPriced = (e: EntitySummary): boolean => registryFor(e)?.paymentPattern === 'fixed_price';

const canBePaid = (context: FullUserContext): boolean =>
  context.wallets.length > 0 ||
  !!context.paymentCapabilities?.hasNwcWallet ||
  !!context.paymentCapabilities?.lightningAddress;

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(APP_LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

// ─── Openers ──────────────────────────────────────────────────────────────────

/**
 * Everything the Cat could bring up, most timely first. Each names a real
 * object of the user's, which is what lets it justify being said at all.
 */
export function detectOpeners(context: FullUserContext, now: Date = new Date()): CatOpener[] {
  return detect(context, now).openers;
}

/** The openers, and how many of them (from the front) are timely rather than standing. */
function detect(
  context: FullUserContext,
  now: Date
): { openers: CatOpener[]; timelyCount: number } {
  const openers: CatOpener[] = [];
  const entities = context.entities.filter(e => !isPlaceholderTitle(e.title));
  const title = (e: EntitySummary) => truncate(e.title, MAX_TITLE_CHARS);

  // ── Timely: something happened, or is about to ──

  // Loki first: a build blocked on its owner is the one thing here that is
  // literally waiting for them, and until the rail ran both ways Cat could not
  // see it at all.
  const loki = context.lokiProjects ?? [];
  const waiting = loki.find(p => p.status === 'blocked' && p.blockReason === 'awaiting_user');
  if (waiting) {
    const name = truncate(waiting.name, MAX_TITLE_CHARS);
    openers.push({
      key: `loki-waiting:${waiting.id}:${waiting.currentWork ?? ''}`,
      say: `Loki is waiting on you to continue "${name}".`,
      replies: [`What does "${name}" need from me?`],
    });
  }
  const withFeedback = loki.find(p => p.feedback.new > 0);
  if (withFeedback) {
    const name = truncate(withFeedback.name, MAX_TITLE_CHARS);
    openers.push({
      key: `loki-feedback:${withFeedback.id}:${withFeedback.feedback.new}`,
      say: `"${name}" has ${plural(withFeedback.feedback.new, 'new piece')} of visitor feedback in Loki.`,
      // Cat sees the count and the Loki link, not the feedback text — so the
      // reply asks for the next step, never for a summary it would invent.
      replies: [`How do I act on the feedback for "${name}"?`],
    });
  }

  const sales = context.inboundActivity?.recentSales ?? [];
  if (sales.length > 0) {
    const latest = sales[0];
    const name = truncate(latest.entity_title, MAX_TITLE_CHARS);
    openers.push({
      key: `sales:${latest.created_at}`,
      say:
        sales.length === 1
          ? `"${name}" sold recently.`
          : `You've had ${plural(sales.length, 'sale')} recently — the latest was "${name}".`,
      replies: ['How should I follow up with my buyers?', 'What should I offer next?'],
    });
  }

  const booking = context.inboundActivity?.upcomingBookings?.[0];
  if (booking) {
    const who = booking.customer_display_name || booking.customer_username || 'a customer';
    openers.push({
      key: `booking:${booking.starts_at}`,
      say: `You have a booking with ${who} on ${shortDate(booking.starts_at)}.`,
      replies: ['Help me prepare for it'],
    });
  }

  // The context fetch only loads open tasks, so "past due" is "overdue".
  const overdue = context.tasks.find(t => !!t.due_date && new Date(t.due_date) < now);
  if (overdue?.due_date) {
    const name = truncate(overdue.title, MAX_TITLE_CHARS);
    openers.push({
      key: `task:${overdue.id}`,
      say: `"${name}" was due ${shortDate(overdue.due_date)} and is still open.`,
      replies: [`Help me get "${name}" done`, `Move "${name}" to next week`],
    });
  }

  const unread = context.notifications ?? [];
  if (unread.length > 0) {
    // The exact count, not a sum of the coalesced groups: those cover only the
    // newest rows fetched, so summing them said "30" beside a bell that said 80.
    const total = context.notificationsUnread ?? unread.reduce((n, x) => n + (x.count || 1), 0);
    const latest = [...unread].sort((a, b) => b.latest_at.localeCompare(a.latest_at))[0];
    openers.push({
      key: `notifications:${latest.latest_at}`,
      say: `You have ${plural(total, 'unread notification')} — the latest is "${truncate(latest.title, MAX_TITLE_CHARS)}".`,
      replies: ['What needs my attention?'],
    });
  }

  const timelyCount = openers.length;

  // ── Where they said they're going ──

  const goal = context.economicProfile?.goals?.[0]?.text?.trim();
  if (goal) {
    openers.push({
      key: `goal:${fingerprint(goal)}`,
      say: `You're working toward "${truncate(goal, 80)}". Want to take the next step together?`,
      // Names the goal: as a chip this is read with no opener above it, and
      // "the next step toward it" pointed at nothing.
      replies: [`What's the next step toward "${truncate(goal, MAX_TITLE_CHARS)}"?`],
    });
  }

  // ── Gaps: things standing between their work and getting paid ──

  if (entities.length > 0 && !canBePaid(context)) {
    openers.push({
      key: 'payment',
      say: `You have ${plural(entities.length, 'listing')} but no way to receive money yet.`,
      replies: ['Help me set up a way to get paid'],
    });
  }

  const drafts = entities.filter(isDraft);
  if (drafts.length === 1) {
    const name = title(drafts[0]);
    openers.push({
      key: `draft:${drafts[0].id}`,
      say: `"${name}" is still a draft, so nobody can see it yet.`,
      replies: [`What's missing before I publish "${name}"?`],
    });
  } else if (drafts.length > 1) {
    openers.push({
      // Keyed on the set, so a new draft re-opens the topic after a dismissal.
      key: `drafts:${fingerprint(drafts.map(d => d.id).join(','))}`,
      say: `You have ${drafts.length} drafts nobody can see yet.`,
      replies: ['Which of my drafts is worth publishing?', 'Help me clean up my drafts'],
    });
  }

  const live = entities.filter(e => !isDraft(e));

  const undescribed = live.find(e => !e.description?.trim());
  if (undescribed) {
    const name = title(undescribed);
    openers.push({
      key: `description:${undescribed.id}`,
      say: `"${name}" is live but has no description, so people can't tell what it is.`,
      replies: [`Write a description for "${name}"`],
    });
  }

  const unpriced = live.find(e => isPriced(e) && !e.price_btc);
  if (unpriced) {
    const name = title(unpriced);
    openers.push({
      key: `price:${unpriced.id}`,
      say: `"${name}" has no price, so nobody can buy it.`,
      replies: [`What should I charge for "${name}"?`],
    });
  }

  if (!context.profile?.bio?.trim()) {
    openers.push({
      key: 'bio',
      say: "Your profile has no bio yet — it's the first thing visitors read.",
      replies: ['Help me write my bio'],
    });
  }

  const ready = canBePaid(context) ? live.find(e => !!e.description?.trim()) : undefined;
  if (ready) {
    const name = title(ready);
    openers.push({
      key: `demand:${ready.id}`,
      say: `"${name}" is live and can take payment. The next lever is getting it in front of people.`,
      replies: [`Who on OrangeCat might want "${name}"?`, `Help me promote "${name}"`],
    });
  }

  return {
    openers: openers.slice(0, MAX_OPENERS),
    timelyCount: Math.min(timelyCount, MAX_OPENERS),
  };
}

// ─── Chips ─────────────────────────────────────────────────────────────────────

/** Days since the epoch for a 'YYYY-MM-DD' — the number the chip order turns on. */
const dayNumber = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

const rotate = <T>(items: T[], by: number): T[] => {
  if (items.length === 0) {
    return items;
  }
  const n = by % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
};

function dedupe(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = item.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

/** The user's own things, for the composer's "+" menu — listings first, then notes. */
export function listAttachable(context: FullUserContext): CatReference[] {
  return [
    ...context.entities.map(e => ({ type: e.type, id: e.id, title: e.title })),
    ...context.documents.map(d => ({ type: 'document', id: d.id, title: d.title })),
  ].slice(0, MAX_ATTACHABLE);
}

/**
 * The chips: the most timely fact's reply (the brief above already counted
 * the rest, and its own reply covers them), then the standing topics turned by
 * the calendar day so tomorrow leads with a different one, then the starters.
 */
function chipsFrom(timely: CatOpener[], standing: CatOpener[], day: string): string[] {
  const turned = rotate(standing, dayNumber(day));
  const ordered = [...timely.slice(0, 1), ...turned, ...timely.slice(1)];
  return dedupe([...ordered.map(o => o.replies[0]), ...getStarterChips()], CAT_HOME_MAX_CHIPS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compose what the Cat opens with for this user. Never throws, never returns an
 * empty screen: the registry-derived starters stand in for everything.
 */
export async function generateCatHome(
  _userId: string,
  context: FullUserContext,
  memories: string[] = [],
  /** `zone` is the viewer's own (their browser's); the profile's is the fallback. */
  at: { now?: Date; zone?: string | null } = {}
): Promise<CatHome> {
  if (!hasRichContext(context) && memories.length === 0) {
    return STARTER_HOME;
  }

  const now = at.now ?? new Date();
  const zone = isValidTimeZone(at.zone) ? at.zone : context.profile?.timezone;
  const brief = composeDayBrief(context, now, zone);
  const { openers: facts, timelyCount } = detect(context, now);
  return {
    openers: [brief, ...facts],
    chips: chipsFrom(
      facts.slice(0, timelyCount),
      facts.slice(timelyCount),
      localClock(now, zone).day
    ),
    attachable: listAttachable(context),
  };
}
