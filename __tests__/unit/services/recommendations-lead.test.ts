import { describe, expect, it } from 'vitest';
import { getRecommendedTasks } from '@/services/recommendations';
import type { UserContext } from '@/services/recommendations/types';

// A brand-new account: no username, no name, nothing made.
const fresh = {
  profile: { id: 'u1', username: null, display_name: null },
  entityCounts: {},
  hasWallet: false,
  profileCompletion: 0,
} as unknown as UserContext;

describe('recommended tasks', () => {
  it('lead with the step that does the rest, ahead of profile chores', () => {
    const tasks = getRecommendedTasks(fresh, { limit: 2 });
    expect(tasks[0]?.id).toBe('chat-with-cat');
  });

  it('use sentence case for every title', () => {
    for (const task of getRecommendedTasks(fresh, { limit: 50 })) {
      const words = task.title.split(' ').slice(1);
      const capitalised = words.filter(
        w => /^[A-Z][a-z]/.test(w) && !['Bitcoin', 'Cat'].includes(w)
      );
      expect(capitalised, task.title).toEqual([]);
    }
  });
});
