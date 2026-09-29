/**
 * Open-science rules for research entities — pure, no HTTP, no UI.
 *
 * Validation for licence / output links / pre-registration, the kind of an
 * output derived from its link, and the one rule that makes a pre-registration
 * worth anything: once committed it never changes. The database enforces that
 * rule too (trigger research_preregistration_is_immutable); this module is the
 * friendly half, so the API can say why instead of surfacing a DB error.
 */

import { z } from 'zod';
import {
  CONTENT_ADDRESSED_SCHEMES,
  OPEN_SCIENCE_LIMITS,
  OUTPUT_KIND_BY_HOST,
  OUTPUT_LINK_SCHEMES,
  RESEARCH_LICENSES,
  RESEARCH_LICENSE_VALUES,
  type OutputKind,
} from '@/config/open-science';

function schemeOf(link: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(link);
  return match ? match[1].toLowerCase() : null;
}

export function isAllowedOutputLink(link: string): boolean {
  const scheme = schemeOf(link);
  if (!scheme || !(OUTPUT_LINK_SCHEMES as readonly string[]).includes(scheme)) {
    return false;
  }
  if (scheme === 'http' || scheme === 'https') {
    try {
      return Boolean(new URL(link).hostname);
    } catch {
      return false;
    }
  }
  // ipfs://<cid>[/path], ipns://<name>, ar://<txid> — something after the scheme.
  return /^[a-z]+:\/\/\S+$/i.test(link);
}

/** The address is the hash: the content cannot be replaced behind the link. */
export function isContentAddressed(link: string): boolean {
  const scheme = schemeOf(link);
  return Boolean(scheme && (CONTENT_ADDRESSED_SCHEMES as readonly string[]).includes(scheme));
}

export function outputKindOf(link: string): OutputKind {
  const scheme = schemeOf(link);
  if (scheme !== 'http' && scheme !== 'https') {
    return 'link';
  }
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase();
  } catch {
    return 'link';
  }
  if (host === 'doi.org' || host.endsWith('.doi.org')) {
    // A DOI names a published record; what it resolves to is not knowable here.
    return 'link';
  }
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const kind = OUTPUT_KIND_BY_HOST[parts.slice(i).join('.')];
    if (kind) {
      return kind;
    }
  }
  return 'link';
}

export function isOpenLicense(license: string | null | undefined): boolean {
  return RESEARCH_LICENSES.some(l => l.value === license && l.open);
}

// ==================== ZOD FIELDS (spread into the research schema) ====================

export const openScienceFields = {
  // An untouched select submits '' — that means "not stated", not an invalid value.
  license: z.preprocess(
    v => (v === '' ? null : v),
    z.enum(RESEARCH_LICENSE_VALUES).nullable().optional()
  ),
  output_links: z
    .array(
      z
        .string()
        .trim()
        .max(OPEN_SCIENCE_LIMITS.MAX_OUTPUT_LINK_LENGTH)
        .refine(isAllowedOutputLink, {
          message: 'Each output must be an https://, ipfs://, ipns:// or ar:// link',
        })
    )
    .max(OPEN_SCIENCE_LIMITS.MAX_OUTPUT_LINKS)
    .optional(),
  preregistration: z
    .string()
    .trim()
    .max(OPEN_SCIENCE_LIMITS.MAX_PREREGISTRATION_LENGTH)
    .nullable()
    .optional(),
};

// ==================== PRE-REGISTRATION ====================

export interface PreregistrationColumns {
  preregistration: string;
  preregistration_sha256: string;
  preregistered_at: string;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The columns a first commitment writes. Anyone can re-hash the text to check it. */
export async function commitPreregistration(
  text: string,
  now: Date = new Date()
): Promise<PreregistrationColumns> {
  return {
    preregistration: text,
    preregistration_sha256: await sha256Hex(text),
    preregistered_at: now.toISOString(),
  };
}

export type PreregistrationDecision =
  { kind: 'none' } | { kind: 'commit'; text: string } | { kind: 'locked' };

/**
 * What an incoming `preregistration` value means for a row.
 *
 * - blank / absent → nothing to do (a committed one is kept, not cleared)
 * - same text as the committed one → nothing to do (the edit form resends it)
 * - new text on a row with no commitment → commit it
 * - different text on a committed row → locked; the caller refuses
 */
export function decidePreregistration(
  incoming: string | null | undefined,
  existing: { preregistration?: string | null; preregistered_at?: string | null } | null
): PreregistrationDecision {
  const text = incoming?.trim();
  if (!text) {
    return { kind: 'none' };
  }
  if (existing?.preregistered_at) {
    return text === existing.preregistration ? { kind: 'none' } : { kind: 'locked' };
  }
  return { kind: 'commit', text };
}

export const PREREGISTRATION_LOCKED_MESSAGE =
  'This pre-registration was committed and can no longer be changed. Post what changed as a progress update instead — that is what keeps the original credible.';
