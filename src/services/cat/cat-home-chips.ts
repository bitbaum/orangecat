/**
 * CAT HOME CHIPS — the LLM half of the Cat's empty-chat home.
 *
 * Writes the short things a user might ask, in their voice, from a digest of
 * their state (built in ./prompt-suggestions, which also caches and rotates the
 * result). Every chip must quote the words of the state it builds on, or it is
 * dropped: see isGroundedChip.
 */

import { callPlatformJson, parseJsonLoose } from './platform-llm';

/** A chip longer than this stops being a chip and becomes reading. */
const MAX_CHIP_CHARS = 55;
/**
 * Callers do not wait this long — ./prompt-suggestions races it against a
 * first-paint deadline and lets it finish into the cache.
 */
const LLM_TIMEOUT_MS = 15_000;

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

const SYSTEM_PROMPT = [
  'You help a user of OrangeCat (a Bitcoin-native platform where people list',
  'products, services, projects and causes and get paid for them) think of what',
  'to ask their AI agent, Cat.',
  '',
  'Write short messages the USER would send, in their own first-person voice.',
  'Never start with "Cat" or address Cat by name. Never write as Cat.',
  '',
  'Return JSON exactly:',
  '{"chips":[{"text":"...","from":"..."}, ...]} with 6 items.',
  '"from" is 2-6 words COPIED EXACTLY from the state that the chip builds on.',
  '',
  'Rules:',
  `- Each chip is at most 8 words and ${MAX_CHIP_CHARS} characters: a plain request or question.`,
  '- Make them PERSONAL: every chip builds on one line of the state — a goal,',
  '  a skill, a listing, or something Cat remembers — and names that thing.',
  '- Only things Cat can do on OrangeCat: pricing, writing listings, finding',
  '  buyers, collaborators or funding, promotion, planning their week or their',
  '  next offer. Vary across these — not all about one listing. Nothing',
  '  unrelated to their work (no coding lessons, trivia, weather).',
  '- Never mention an offering, skill, number or person that is not in the state.',
  '- Output JSON only.',
].join('\n');

/** Removes the "Cat, …" address the model keeps writing despite being told not to. */
export function cleanChip(v: unknown): string | null {
  if (typeof v !== 'string') {
    return null;
  }
  let s = v
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '');
  s = s.replace(/^(hey |hi )?cat[,:!]?\s+/i, '');
  if (!s || s.length > MAX_CHIP_CHARS * 1.5 || /https?:\/\//i.test(s)) {
    return null;
  }
  // A chip is a tap target, not a sentence: no closing full stop.
  s = s.replace(/\.+$/, '');
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return truncate(s, MAX_CHIP_CHARS);
}

export async function generateChips(digest: string): Promise<string[]> {
  const raw = await callPlatformJson(SYSTEM_PROMPT, `This user's state:\n${digest}`, {
    // gpt-oss reasons before it writes (~700 tokens here), and Groq's JSON
    // mode rejects a document cut off mid-way ("max completion tokens reached
    // before generating a valid document") — at 400 and at the 1400 default
    // most calls came back empty. Measured: ~1.6–2k total. Cached per state,
    // so this is paid once per change, not per visit.
    maxTokens: 2500,
    temperature: 0.6,
    timeoutMs: LLM_TIMEOUT_MS,
  });
  const parsed = parseJsonLoose<{ chips?: unknown }>(raw);
  if (!parsed || !Array.isArray(parsed.chips)) {
    return [];
  }
  return parsed.chips
    .filter(c => isGroundedChip(c, digest))
    .map(c => cleanChip((c as { text: string }).text))
    .filter((c): c is string => !!c);
}

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * A chip survives only if the words it claims to build on are really in the
 * state. Without this, the free model offered a ceramicist "Promote my
 * hair-cut services" — the same "haircuts to a ceramicist" failure the nudge
 * engine guards against, one prompt over.
 */
export function isGroundedChip(chip: unknown, digest: string): boolean {
  const c = chip as { text?: unknown; from?: unknown };
  if (!c || typeof c.text !== 'string' || typeof c.from !== 'string') {
    return false;
  }
  const from = fold(c.from);
  return from.length >= 4 && fold(digest).includes(from);
}
