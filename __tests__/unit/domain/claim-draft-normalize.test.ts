/**
 * A link already sent to a real person must keep working.
 *
 * `profile_claims.draft` has now had THREE shapes, and `normalizeClaimDraft`
 * is its only reader, so it has to accept all of them forever — the
 * alternative is a stranger opening a link a friend sent them and seeing a
 * broken page.
 *
 *   { name, bio?, ... }                          ← flat, pre-2026-09-07
 *   { kind:'person', profile:{...}, entities:[] } ← the entities[] shape (#909)
 *   { kind:'person', profile:{...} }              ← current (ADR-0005)
 *
 * ADR-0005 removed `entities[]`: the things a person will own are REAL rows
 * owned by their placeholder actor from the moment they are created, so the
 * draft carries only the person. Rows written during the few hours #909 was
 * live still parse — zod strips the unknown key rather than rejecting the row.
 */

import { normalizeClaimDraft, claimDraftSchema } from '@/domain/profileClaims/draft';

describe('normalizeClaimDraft', () => {
  it('reads the legacy flat person shape', () => {
    const draft = normalizeClaimDraft({
      name: 'Maria Rossi',
      bio: 'Paints, mostly large.',
      website: 'https://studio.test',
    });

    expect(draft).toEqual({
      kind: 'person',
      profile: {
        name: 'Maria Rossi',
        bio: 'Paints, mostly large.',
        website: 'https://studio.test',
      },
    });
  });

  it('reads the current shape unchanged', () => {
    const input = { kind: 'person' as const, profile: { name: 'Maria Rossi' } };
    expect(normalizeClaimDraft(input)).toEqual(input);
  });

  it('still reads a row written while entities[] was live, dropping the key', () => {
    // #909 shipped and was superseded the same day. Any row it wrote must not
    // become an unreadable draft — which would burn a link somebody had
    // already sent to a real person.
    const draft = normalizeClaimDraft({
      kind: 'person',
      profile: { name: 'Maria Rossi' },
      entities: [{ kind: 'project', title: 'Studio', description: 'Out back.' }],
    });

    expect(draft).toEqual({ kind: 'person', profile: { name: 'Maria Rossi' } });
    expect(draft).not.toHaveProperty('entities');
  });

  it('returns null for something that is not a draft at all', () => {
    // A caller seeing null must treat the claim as broken rather than render
    // an empty person — which is why this is null and not `{name: ''}`.
    for (const junk of [null, undefined, 42, 'maria', {}, { profile: {} }, { name: '' }]) {
      expect(normalizeClaimDraft(junk)).toBeNull();
    }
  });

  it('requires a name, because the page has to say whose it is', () => {
    expect(claimDraftSchema.safeParse({ kind: 'person', profile: {} }).success).toBe(false);
    expect(claimDraftSchema.safeParse({ kind: 'person', profile: { name: 'Maria' } }).success).toBe(
      true
    );
  });
});
