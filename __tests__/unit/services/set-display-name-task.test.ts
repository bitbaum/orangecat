/**
 * The prompt that asks the accounts swept on 2026-08-26 for a display name.
 *
 * The positive case is the easy half. The one that matters is the NEGATIVE:
 * a user who chose a readable handle and simply has not filled in a display
 * name is not broken, and must not be given a high-priority nag. Conditioning
 * on "no display name" alone would have caught every such person — which is how
 * a repair turns into spam.
 */

import { describe, expect, it } from 'vitest';
import { TASK_DEFINITIONS } from '@/services/recommendations/tasks';
import type { UserContext } from '@/services/recommendations/types';

const task = TASK_DEFINITIONS.find(t => t.id === 'set-display-name');

function ctx(profile: Partial<UserContext['profile']>): UserContext {
  return {
    profile: { id: 'u1', ...profile },
    entityCounts: {},
    hasWallet: false,
    profileCompletion: 0,
  } as UserContext;
}

const shows = (profile: Partial<UserContext['profile']>) => task!.condition(ctx(profile));

describe('set-display-name task', () => {
  it('exists and is not critical — being nameless degrades every interaction, it does not block one', () => {
    expect(task).toBeDefined();
    expect(task!.priority).toBe('high');
  });

  it('shows for an account the sweep left nameless behind a minted handle', () => {
    expect(shows({ username: 'user_a3eaa53c23cd', display_name: null })).toBe(true);
  });

  it('does NOT show for a user who picked a readable handle and skipped the name', () => {
    // The whole reason the condition tests the handle and not just the name.
    expect(shows({ username: 'adelina', display_name: null })).toBe(false);
  });

  it('stops showing once the name is restored or entered', () => {
    expect(shows({ username: 'user_a3eaa53c23cd', display_name: 'Metal Music' })).toBe(false);
  });

  it('treats a whitespace-only name as no name', () => {
    expect(shows({ username: 'user_a3eaa53c23cd', display_name: '   ' })).toBe(true);
  });

  it('treats an empty-string name as no name', () => {
    // The messages API coerces a NULL name to '' on the way out, so both shapes
    // reach the client and both mean "unnamed".
    expect(shows({ username: 'user_b4c9f3272af7', display_name: '' })).toBe(true);
  });

  it('matches both the 8-hex and 12-hex mints', () => {
    // 20260818140000 minted 8 chars, 20260826130000 mints 12. Both are ours.
    expect(shows({ username: 'user_a3eaa53c', display_name: null })).toBe(true);
    expect(shows({ username: 'user_a3eaa53c23cd', display_name: null })).toBe(true);
  });

  it('does not match a handle that merely starts with user_', () => {
    // `user_smith` is somebody's chosen name, not a mint.
    expect(shows({ username: 'user_smith', display_name: null })).toBe(false);
  });

  it('survives a missing username without throwing', () => {
    expect(shows({ username: null, display_name: null })).toBe(false);
    expect(shows({ display_name: null })).toBe(false);
  });
});
