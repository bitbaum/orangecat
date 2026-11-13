/**
 * Profile completion counts the weights it declares. It used to count fields
 * equally, so a phone number moved the bar as much as a username.
 */
import { describe, expect, it } from 'vitest';
import {
  PROFILE_COMPLETION_FIELDS,
  getProfileCompletionPercentage,
  getProfileMissingFields,
} from '@/app/(authenticated)/dashboard/info/edit/profile-completion';
import type { Profile } from '@/types/profile';

const profile = (fields: Partial<Profile>) => fields as Profile;

describe('profile completion', () => {
  it('declares weights that add up to 100', () => {
    expect(PROFILE_COMPLETION_FIELDS.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
  });

  it('a username alone is its weight, not one field in eleven', () => {
    expect(getProfileCompletionPercentage(profile({ username: 'ana' }))).toBe(20);
  });

  it('a phone number alone counts for less than a username', () => {
    expect(getProfileCompletionPercentage(profile({ phone: '+41 79 000 00 00' }))).toBe(5);
  });

  it('lists Name as missing until a name is actually given', () => {
    expect(getProfileMissingFields(profile({ username: 'ana' }))).toContain('Name');
    expect(getProfileMissingFields(profile({ username: 'ana', name: 'Ana' }))).not.toContain(
      'Name'
    );
  });
});
