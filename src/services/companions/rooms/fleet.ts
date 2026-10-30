/**
 * The fleet's bots as members of the room.
 *
 * Identity comes from the fleet map (name, what, live url); behaviour is the
 * shared `/api/ask` contract in `src/config/fleet-bots.ts`. Without the map
 * there are no fleet bots on this rail — rather than a typed host that could
 * be stale, the rail says the fleet is unreachable just now.
 */

import { fileBlocksIn } from '@/lib/chat/attachment-tags';
import { API_ROUTES } from '@/config/api-routes';
import {
  FLEET_BOTS,
  FLEET_BOT_LOCALE,
  FLEET_BOT_ASK_CAPS,
  FLEET_BOT_TIMEOUT_MS,
  fleetBotAskUrl,
  isFleetBotSlug,
} from '@/config/fleet-bots';
import { fetchStudioMapForCat, type StudioMapProject } from '@/services/ai/studio-map-fetcher';
import { logger } from '@/utils/logger';
import type { RoomTurnError } from './types';

export interface FleetBot {
  slug: string;
  name: string;
  /** The product's whole "what", as Loki publishes it. */
  what: string | null;
  /** Its first sentence: the one line under the name. */
  job: string | null;
  /** Where it runs — and where the person is sent to use it in full. */
  url: string;
  /** The product's own mark, served by the product itself. */
  mark: string;
}

/** "Reads a report with you. Beta: running, not released." → "Reads a report with you." */
export function firstSentence(text: string | null | undefined): string | null {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return null;
  }
  const m = /^(.+?[.!?])(\s|$)/.exec(clean);
  return (m ? m[1] : clean).slice(0, 160);
}

/**
 * The one word under the name, in the map's own phrasing: "The health layer
 * of the fleet: …" → "health". Any other phrasing keeps its first sentence.
 */
export function jobLine(what: string | null | undefined): string | null {
  const m = /^The (\w+) layer of the fleet\b/i.exec((what ?? '').trim());
  return m ? m[1].toLowerCase() : firstSentence(what);
}

/** The display name: the map's `name`, with a bare slug capitalised ("loki" → "Loki"). */
export function displayName(project: Pick<StudioMapProject, 'slug' | 'name'>): string {
  const name = project.name?.trim();
  if (name && name !== project.slug) {
    return name;
  }
  const slug = project.slug;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function fleetBotsFromMap(
  projects: readonly Pick<StudioMapProject, 'slug' | 'name' | 'what' | 'urls'>[]
): FleetBot[] {
  const bots: FleetBot[] = [];
  for (const slug of Object.keys(FLEET_BOTS)) {
    const project = projects.find(p => p.slug === slug);
    const url = project?.urls?.live;
    if (!project || !url) {
      continue;
    }
    bots.push({
      slug,
      name: displayName(project),
      what: project.what,
      job: jobLine(project.what),
      url: url.replace(/\/+$/, ''),
      mark: API_ROUTES.AI_ASSISTANTS.FLEET_MARK(slug),
    });
  }
  return bots;
}

export async function fleetBots(): Promise<{ bots: FleetBot[]; mapReachable: boolean }> {
  const map = await fetchStudioMapForCat();
  if (!map) {
    return { bots: [], mapReachable: false };
  }
  return { bots: fleetBotsFromMap(map.projects), mapReachable: true };
}

export async function fleetBot(slug: string): Promise<FleetBot | null> {
  if (!isFleetBotSlug(slug)) {
    return null;
  }
  const { bots } = await fleetBots();
  return bots.find(b => b.slug === slug) ?? null;
}

export interface FleetAnswer {
  text: string;
  replies: string[];
}

/** One line from a fleet bot, over the shared contract. */
/**
 * The request as the contract takes it. A file the person attached travels
 * as `context` (the product reads it between its own file tags), not inside
 * a 4,000-character line; the newest files win when several would not fit.
 */
export function fleetAskBody(
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
  locale: string
): {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: string;
  locale: string;
} {
  const kept = messages.slice(-FLEET_BOT_ASK_CAPS.turns);
  const blocks = kept.flatMap(m => (m.role === 'user' ? fileBlocksIn(m.content) : []));
  let context = '';
  for (const b of blocks.reverse()) {
    const piece = `--- ${b.name} ---\n${b.body}\n\n`;
    if (context.length + piece.length > FLEET_BOT_ASK_CAPS.contextChars) {
      break;
    }
    context = piece + context;
  }
  const stripped = kept.map(m => {
    const text = fileBlocksIn(m.content).length
      ? m.content.replace(/<attached_file name="[^"]*">[\s\S]*?<\/attached_file>/g, '').trim()
      : m.content;
    return {
      role: m.role,
      content: (text || '(see the attached file)').slice(0, FLEET_BOT_ASK_CAPS.messageChars),
    };
  });
  return { messages: stripped, context: context.trim(), locale };
}

export async function askFleetBot(
  bot: FleetBot,
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}
): Promise<FleetAnswer | { error: RoomTurnError }> {
  const locale = FLEET_BOTS[bot.slug]?.locales.includes(FLEET_BOT_LOCALE)
    ? FLEET_BOT_LOCALE
    : (FLEET_BOTS[bot.slug]?.locales[0] ?? FLEET_BOT_LOCALE);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(fleetBotAskUrl(bot.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(fleetAskBody(messages, locale)),
      signal: options.signal ?? AbortSignal.timeout(FLEET_BOT_TIMEOUT_MS),
    });
    if (res.status === 429) {
      return {
        error: {
          code: 'RATE_LIMITED',
          message: `${bot.name} is answering too many people right now. Try again shortly.`,
        },
      };
    }
    if (res.status === 503) {
      return { error: { code: 'SERVICE_UNAVAILABLE' } };
    }
    if (!res.ok) {
      return {
        error: {
          code: 'AI_ERROR',
          message: `${bot.name} could not answer just now (${res.status}).`,
        },
      };
    }
    const body = (await res.json()) as { text?: unknown; replies?: unknown };
    if (typeof body.text !== 'string' || !body.text.trim()) {
      return { error: { code: 'AI_ERROR', message: `${bot.name} answered with nothing.` } };
    }
    const replies = Array.isArray(body.replies)
      ? body.replies.filter((r): r is string => typeof r === 'string')
      : [];
    return { text: body.text, replies };
  } catch (error) {
    logger.warn('fleet bot unreachable', { slug: bot.slug, error }, 'CompanionRooms');
    return {
      error: { code: 'AI_ERROR', message: `${bot.name} did not answer in time.` },
    };
  }
}
