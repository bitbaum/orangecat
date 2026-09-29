/**
 * Research on Nostr — the event a researcher signs, and the check the server
 * runs before it records that the research lives there.
 *
 * Pure: no HTTP, no relays, no keys. The browser builds the template here,
 * the researcher's own NIP-07 extension signs it, the browser publishes it to
 * relays, and the server verifies it with `verifyResearchNostrEvent` before
 * storing its id. OrangeCat never holds the secret key, so the published
 * record does not depend on OrangeCat — which is the point.
 */

import { verifyEvent, nip19, type Event } from 'nostr-tools';
import { RESEARCH_LICENSES, RESEARCH_NOSTR } from '@/config/open-science';
import { DEFAULT_RELAYS } from '@/lib/nostr/types';

export interface ResearchForNostr {
  id: string;
  title: string;
  description: string;
  field?: string | null;
  license?: string | null;
  output_links?: string[] | null;
  preregistration?: string | null;
  preregistration_sha256?: string | null;
  preregistered_at?: string | null;
}

export interface NostrEventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

const PREREG_TAG = 'preregistration_sha256';

function summaryOf(description: string): string {
  const flat = description.replace(/\s+/g, ' ').trim();
  return flat.length <= RESEARCH_NOSTR.SUMMARY_MAX_LENGTH
    ? flat
    : `${flat.slice(0, RESEARCH_NOSTR.SUMMARY_MAX_LENGTH - 1)}…`;
}

/** Markdown body — readable in any NIP-23 client, with nothing OrangeCat-only in it. */
function contentOf(r: ResearchForNostr, pageUrl: string): string {
  const license = RESEARCH_LICENSES.find(l => l.value === r.license);
  const parts = [`# ${r.title}`, r.description.trim()];
  if (r.preregistration && r.preregistration_sha256 && r.preregistered_at) {
    parts.push(
      '## Pre-registration',
      r.preregistration,
      `Committed ${r.preregistered_at.slice(0, 10)} · SHA-256 \`${r.preregistration_sha256}\``
    );
  }
  const outputs = r.output_links ?? [];
  if (outputs.length > 0) {
    parts.push('## Outputs', outputs.map(link => `- ${link}`).join('\n'));
  }
  parts.push(
    `Licence: ${license ? license.label : 'not stated'}`,
    `Fund it, review it: ${pageUrl}`
  );
  return parts.join('\n\n');
}

/** The unsigned event for the researcher's key to sign. */
export function buildResearchNostrEvent(
  r: ResearchForNostr,
  pageUrl: string,
  now: Date = new Date()
): NostrEventTemplate {
  const createdAt = Math.floor(now.getTime() / 1000);
  const tags: string[][] = [
    ['d', r.id],
    ['title', r.title],
    ['summary', summaryOf(r.description)],
    ['published_at', String(createdAt)],
    ['r', pageUrl],
    ...RESEARCH_NOSTR.HASHTAGS.map(t => ['t', t]),
  ];
  if (r.field) {
    tags.push(['t', r.field.replace(/_/g, '')]);
  }
  if (r.license) {
    tags.push(['license', r.license]);
  }
  for (const link of r.output_links ?? []) {
    tags.push(['r', link]);
  }
  if (r.preregistration_sha256) {
    tags.push([PREREG_TAG, r.preregistration_sha256]);
  }
  return { kind: RESEARCH_NOSTR.KIND, created_at: createdAt, tags, content: contentOf(r, pageUrl) };
}

function tagValue(event: Pick<Event, 'tags'>, name: string): string | undefined {
  return event.tags.find(t => t[0] === name)?.[1];
}

export type NostrVerification = { ok: true; event: Event } | { ok: false; reason: string };

/**
 * Accept a signed event only if it is a valid signature, of the right kind,
 * about THIS research, and — when a pre-registration is committed — carrying
 * the same hash. Anything else would let someone attach an unrelated or
 * altered record to the page.
 */
export function verifyResearchNostrEvent(
  candidate: unknown,
  r: Pick<ResearchForNostr, 'id' | 'preregistration_sha256'>
): NostrVerification {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, reason: 'No signed event was sent.' };
  }
  // Verify a fresh object built from the wire fields only. nostr-tools caches
  // a "verified" flag on the object it checked, and a spread copy of a signed
  // event carries that flag — an edited copy would otherwise pass.
  const raw = candidate as Record<string, unknown>;
  const tagsOk =
    Array.isArray(raw.tags) &&
    raw.tags.every(t => Array.isArray(t) && t.every(part => typeof part === 'string'));
  if (!tagsOk) {
    return { ok: false, reason: 'The event is malformed.' };
  }
  const event: Event = {
    id: String(raw.id ?? ''),
    pubkey: String(raw.pubkey ?? ''),
    created_at: Number(raw.created_at),
    kind: Number(raw.kind),
    tags: raw.tags as string[][],
    content: String(raw.content ?? ''),
    sig: String(raw.sig ?? ''),
  };
  let valid = false;
  try {
    valid = verifyEvent(event);
  } catch {
    valid = false;
  }
  if (!valid) {
    return { ok: false, reason: 'The signature does not verify.' };
  }
  if (event.kind !== RESEARCH_NOSTR.KIND) {
    return { ok: false, reason: `Expected a kind ${RESEARCH_NOSTR.KIND} event.` };
  }
  if (tagValue(event, 'd') !== r.id) {
    return { ok: false, reason: 'This event is about different research.' };
  }
  if (r.preregistration_sha256 && tagValue(event, PREREG_TAG) !== r.preregistration_sha256) {
    return {
      ok: false,
      reason: 'The event does not carry the committed pre-registration. Publish it again.',
    };
  }
  return { ok: true, event };
}

/** Where anyone can read it without a Nostr client. */
export function researchNostrViewUrl(researchId: string, pubkey: string): string {
  const naddr = nip19.naddrEncode({
    kind: RESEARCH_NOSTR.KIND,
    pubkey,
    identifier: researchId,
    relays: DEFAULT_RELAYS.filter(relay => relay.write).map(relay => relay.url),
  });
  return `${RESEARCH_NOSTR.VIEWER_BASE_URL}${naddr}`;
}
