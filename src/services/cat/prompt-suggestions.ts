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
 *   2. CHIPS are what this person might ask, written by the platform LLM (free
 *      pool, never Cat Credits) from a digest that includes what the Cat
 *      REMEMBERS about them and their stated goals — the part the old engine
 *      never looked at. If the LLM is down, the openers' own replies stand in.
 *
 * Freshness: the LLM pool is cached per state fingerprint (recompute only when
 * reality changes) and the three chips shown rotate through it on every serve.
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
import { logger } from '@/utils/logger';
import { APP_LOCALE } from '@/utils/locale';
import { generateChips } from './cat-home-chips';
import type { EntitySummary, FullUserContext } from '@/services/ai/document-context-types';

/** Openers held in reserve behind the one shown, so dismissing has somewhere to go. */
const MAX_OPENERS = 6;
/** LLM chips kept per state, rotated three at a time. */
const MAX_CHIP_POOL = 6;
/** Memories handed to the chip writer — the newest are the most current. */
const MAX_MEMORIES = 8;
/** How long a request waits for the chips before answering with the filler. */
const FIRST_PAINT_MS = 2500;
/** Items offered in the composer's "+" menu. */
const MAX_ATTACHABLE = 20;
/** Entity titles are quoted into copy; long ones are elided. */
const MAX_TITLE_CHARS = 40;

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

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

/** A short, stable hash for keys built from free text (goals). */
function fingerprint(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// ─── Openers ──────────────────────────────────────────────────────────────────

/**
 * Everything the Cat could bring up, most timely first. Each names a real
 * object of the user's, which is what lets it justify being said at all.
 */
export function detectOpeners(context: FullUserContext, now: Date = new Date()): CatOpener[] {
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
    const total = unread.reduce((n, x) => n + (x.count || 1), 0);
    const latest = [...unread].sort((a, b) => b.latest_at.localeCompare(a.latest_at))[0];
    openers.push({
      key: `notifications:${latest.latest_at}`,
      say: `You have ${plural(total, 'unread notification')} — the latest is "${truncate(latest.title, MAX_TITLE_CHARS)}".`,
      replies: ['What needs my attention?'],
    });
  }

  // ── Where they said they're going ──

  const goal = context.economicProfile?.goals?.[0]?.text?.trim();
  if (goal) {
    openers.push({
      key: `goal:${fingerprint(goal)}`,
      say: `You're working toward "${truncate(goal, 80)}". Want to take the next step together?`,
      replies: ["What's the next step toward it?"],
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

  return openers.slice(0, MAX_OPENERS);
}

// ─── Chip digest (what the chip writer may build on — see ./cat-home-chips) ──

function buildDigest(context: FullUserContext, memories: string[]): string {
  const lines: string[] = [];

  if (context.profile?.name) {
    lines.push(`Name: ${context.profile.name}`);
  }
  if (context.profile?.bio) {
    lines.push(`Bio: ${truncate(context.profile.bio, 200)}`);
  }
  for (const g of context.economicProfile?.goals?.slice(0, 3) ?? []) {
    lines.push(`Goal: ${truncate(g.text, 120)}`);
  }
  for (const s of context.economicProfile?.skills?.slice(0, 5) ?? []) {
    lines.push(`Skill: ${truncate(s.name, 60)}`);
  }
  for (const m of memories.slice(0, MAX_MEMORIES)) {
    lines.push(`Cat remembers: ${truncate(m, 160)}`);
  }
  for (const e of context.entities.filter(x => !isPlaceholderTitle(x.title)).slice(0, 8)) {
    lines.push(
      `${registryFor(e)?.name ?? e.type}: "${e.title}" (${isDraft(e) ? 'draft' : 'published'})`
    );
  }
  for (const d of context.documents.slice(0, 4)) {
    lines.push(`Note: "${d.title}"`);
  }

  return lines.filter(l => !/:\s*$/.test(l)).join('\n');
}

// ─── Cache + rotation ────────────────────────────────────────────────────────

/**
 * Process-local cache of the LLM chip pool. Deliberately not a table: derived
 * data with a cheap recompute. The KEY carries the state fingerprint, so a
 * stale entry is impossible — a changed listing or a new memory is a new key.
 */
const cache = new Map<string, string[]>();
/** Generations still running, so a second request joins instead of re-asking. */
const inflight = new Map<string, Promise<string[]>>();
/** How many times each pool has been served — the rotation offset. */
const served = new Map<string, number>();
const MAX_CACHE_ENTRIES = 500;

function remember(key: string, value: string[]): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
      served.delete(oldest);
    }
  }
  cache.set(key, value);
}

function rotate(key: string, pool: string[]): string[] {
  const offset = served.get(key) ?? 0;
  served.set(key, offset + 1);
  if (pool.length <= CAT_HOME_MAX_CHIPS) {
    return pool;
  }
  return Array.from(
    { length: CAT_HOME_MAX_CHIPS },
    (_, i) => pool[(offset * CAT_HOME_MAX_CHIPS + i) % pool.length]
  );
}

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
 * The chips to rotate through. The openers' replies and the starters are only
 * filler — when the model wrote enough, rotating into them would bring the
 * chores back.
 */
function poolFrom(generated: string[], openers: CatOpener[]): string[] {
  if (generated.length >= CAT_HOME_MAX_CHIPS) {
    return dedupe(generated, MAX_CHIP_POOL);
  }
  const fallback = [...openers.slice(1).map(o => o.replies[0]), ...getStarterChips()];
  return dedupe([...generated, ...fallback], CAT_HOME_MAX_CHIPS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compose what the Cat opens with for this user. Never throws, never returns an
 * empty screen: the openers' own replies stand in for the LLM, and the
 * registry-derived starters stand in for everything.
 */
export async function generateCatHome(
  userId: string,
  context: FullUserContext,
  memories: string[] = []
): Promise<CatHome> {
  if (!hasRichContext(context) && memories.length === 0) {
    return STARTER_HOME;
  }

  const openers = detectOpeners(context);
  const digest = buildDigest(context, memories);
  const key = `${userId}:${fingerprint(digest)}`;

  let pool = cache.get(key);
  if (!pool) {
    // The model takes seconds (it reasons first); the openers are ready now.
    // Wait briefly, and if it is slower, answer with the filler while the
    // model finishes in the background and fills the cache for next time.
    // The process is long-lived (self-hosted Node), so the promise outlives
    // the request.
    let pending = inflight.get(key);
    if (!pending) {
      pending = generateChips(digest)
        .then(generated => {
          if (generated.length > 0) {
            remember(key, poolFrom(generated, openers));
          }
          return generated;
        })
        .catch(error => {
          logger.warn('cat-home: chip generation failed', { error }, 'PromptSuggestions');
          return [] as string[];
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    const generated = await Promise.race([
      pending,
      new Promise<string[]>(resolve => setTimeout(() => resolve([]), FIRST_PAINT_MS)),
    ]);
    pool = cache.get(key) ?? poolFrom(generated, openers);
  }

  return { openers, chips: rotate(key, pool), attachable: listAttachable(context) };
}
