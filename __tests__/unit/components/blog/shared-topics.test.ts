import { describe, expect, it } from 'vitest';
import { sharedTopics } from '@/components/blog/useBlogFilters';

describe('sharedTopics (blog topic filters)', () => {
  const posts = [
    { tags: ['Bitcoin', 'Lightning'] },
    { tags: ['bitcoin', 'Governance'] },
    { tags: ['Lightning'] },
    { tags: ['Essay'] },
  ];
  const tags = ['Bitcoin', 'Essay', 'Governance', 'Lightning'];

  it('keeps only topics two or more posts share, case-insensitively', () => {
    expect(sharedTopics(posts, tags)).toEqual(['Bitcoin', 'Lightning']);
  });

  it('keeps the selected topic even when only one post has it, so it can be cleared', () => {
    expect(sharedTopics(posts, tags, 'Essay')).toEqual(['Bitcoin', 'Essay', 'Lightning']);
  });
});
