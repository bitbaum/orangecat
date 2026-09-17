/**
 * What a claim carries.
 *
 * ADR-0004 D1: one primitive, extended — not a second mechanism. A claim used
 * to hold a person and nothing else, so there was nowhere to put the bar that
 * Karl is opening. It now holds a person AND the things that person will own,
 * in the discriminated shape ADR-0003 specified for cold prospecting. A friend
 * setting up a friend and the studio pitching a stranger differ in
 * *provenance*, not in structure.
 *
 * BACKWARD COMPATIBILITY IS NOT OPTIONAL HERE. The claims dashboard became
 * reachable on 2026-09-07 (it had no navigation entry before that, which is
 * why the table had zero rows). Any claim created between then and this
 * deploy carries the old flat person shape:
 *
 *   { name, bio?, avatarUrl?, ... }        ← legacy
 *   { kind: 'person', profile: {...} }     ← current
 *
 * `normalizeClaimDraft` accepts either and always returns the current shape,
 * so a link somebody has already sent to a real person keeps working.
 */

import { z } from 'zod';

const socialLinkSchema = z.object({
  platform: z.string(),
  label: z.string().optional(),
  value: z.string(),
});

export const claimPersonSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  website: z.string().optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
});

// Typed as the LABEL UNION, not `[string, ...]` — the same idiom
// src/services/groups/validation uses. Widening it to `string` here made
// `entity.label` unassignable to `CreateGroupInput.label` downstream, which
// is exactly the sort of thing a draft schema is supposed to prevent.
/**
 * ADR-0005: a claim no longer carries `entities[]`. The things a person will
 * own are REAL rows owned by their placeholder actor from the moment they are
 * created — the placeholder is the container. (Legacy rows that still carry an
 * `entities` key parse fine: zod strips unknown keys.)
 */
export const claimDraftSchema = z.object({
  kind: z.literal('person'),
  profile: claimPersonSchema,
});

export type ClaimDraft = z.infer<typeof claimDraftSchema>;

/**
 * Accept either draft shape, always return the current one.
 *
 * Returns `null` only when the value is not a usable draft at all — a caller
 * that gets null should treat the claim as broken rather than render an empty
 * person.
 */
export function normalizeClaimDraft(raw: unknown): ClaimDraft | null {
  const current = claimDraftSchema.safeParse(raw);
  if (current.success) {
    return current.data;
  }

  // Legacy flat person shape: lift it into `profile` and keep going.
  const legacy = claimPersonSchema.safeParse(raw);
  if (legacy.success) {
    return { kind: 'person', profile: legacy.data };
  }

  return null;
}
