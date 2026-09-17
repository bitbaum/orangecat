/**
 * A claim is a gift, not an overwrite.
 *
 * `claimProfileClaim` used to write `name` and `bio` onto the claimer's
 * profile unconditionally. Someone who already had an OrangeCat account —
 * their own name, their own bio — lost both the moment they accepted a link a
 * friend had made for them. That is silent data loss triggered by a friendly
 * act, which is the worst possible way to lose data.
 *
 * ADR-0004 D6: one path, whether or not the recipient already has an account,
 * and that path fills only what is empty.
 */

import { buildProfileFill, isBlank } from '@/domain/profileClaims/fill';
import type { ProfileClaimDraft } from '@/domain/profileClaims/types';

const fullDraft: ProfileClaimDraft = {
  name: 'Karl Meier',
  bio: 'Runs the Löwenbar in Zürich.',
  avatarUrl: 'https://example.test/karl.jpg',
  bannerUrl: 'https://example.test/bar.jpg',
  website: 'https://loewenbar.test',
  socialLinks: [{ platform: 'instagram', value: '@loewenbar' }],
};

describe('isBlank', () => {
  it('treats absent, empty and whitespace-only as blank', () => {
    for (const value of [null, undefined, '', '   ', '\n\t']) {
      expect(isBlank(value)).toBe(true);
    }
  });

  it('treats an empty array and an empty object as blank', () => {
    // `social_links` holding `{}` is as empty as one holding null, and must
    // not block a gift that actually carries links.
    expect(isBlank([])).toBe(true);
    expect(isBlank({})).toBe(true);
  });

  it('treats any real content as present', () => {
    for (const value of ['a', ' x ', [1], { links: [] }, 0, false]) {
      expect(isBlank(value)).toBe(false);
    }
  });
});

describe('buildProfileFill', () => {
  it('fills everything for a brand-new profile', () => {
    const update = buildProfileFill(fullDraft, {}, 'karl');

    expect(update).toEqual({
      name: 'Karl Meier',
      bio: 'Runs the Löwenbar in Zürich.',
      avatar_url: 'https://example.test/karl.jpg',
      banner_url: 'https://example.test/bar.jpg',
      website: 'https://loewenbar.test',
      social_links: { links: [{ platform: 'instagram', value: '@loewenbar' }] },
      username: 'karl',
    });
  });

  it('never overwrites a name or bio the recipient already wrote', () => {
    const update = buildProfileFill(fullDraft, { name: 'Karl M.', bio: 'My own words.' }, 'karl');

    expect(update).not.toHaveProperty('name');
    expect(update).not.toHaveProperty('bio');
    // ...but still fills what was actually empty.
    expect(update.website).toBe('https://loewenbar.test');
  });

  it('never reassigns an existing handle', () => {
    // A username is a Lightning address and the target of every @mention.
    // Quietly changing it would redirect both.
    const update = buildProfileFill(fullDraft, { username: 'karl_original' }, 'karl');
    expect(update).not.toHaveProperty('username');
  });

  it('returns nothing for a complete profile — a legitimate outcome, not an error', () => {
    const update = buildProfileFill(
      fullDraft,
      {
        name: 'Karl M.',
        bio: 'Mine.',
        avatar_url: 'https://mine.test/a.jpg',
        banner_url: 'https://mine.test/b.jpg',
        website: 'https://mine.test',
        social_links: { links: [{ platform: 'x', value: '@karl' }] },
        username: 'karl_original',
      },
      'karl'
    );

    // Callers must treat this as success rather than issuing an empty UPDATE,
    // which PostgREST rejects.
    expect(Object.keys(update)).toEqual([]);
  });

  it('skips fields the draft simply does not carry', () => {
    const update = buildProfileFill({ name: 'Karl Meier' }, {}, null);
    expect(update).toEqual({ name: 'Karl Meier' });
  });

  it('fills over a blank-but-present value', () => {
    // An account created by signup often has '' rather than null.
    const update = buildProfileFill(fullDraft, { name: '   ', social_links: {} }, null);
    expect(update.name).toBe('Karl Meier');
    expect(update.social_links).toEqual({
      links: [{ platform: 'instagram', value: '@loewenbar' }],
    });
  });

  it('handles a missing profile row without throwing', () => {
    expect(buildProfileFill(fullDraft, null, null).name).toBe('Karl Meier');
    expect(buildProfileFill(fullDraft, undefined, null).name).toBe('Karl Meier');
  });
});
