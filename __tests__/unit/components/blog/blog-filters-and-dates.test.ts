// @vitest-environment jsdom
/**
 * /blog on orangecat.ch (2026-11-12):
 * - West of UTC, posts dated 2026-06-01 were filed under "May 2026", and the
 *   month labels the server rendered differed from the browser's (#418).
 * - A post's topic chip (/blog?tag=BiasLens) opened the unfiltered blog.
 */
// vitest.config pins TZ=UTC, so the west-of-UTC case is shown by the calendar
// reading itself (postMonth never builds a Date); the PR records a run of the
// hook's month bucketing under TZ=America/Los_Angeles.

import { renderHook, act } from '@testing-library/react';
import { useBlogFilters, postMonth } from '@/components/blog/useBlogFilters';
import type { BlogPost } from '@/lib/blog';

const post = (slug: string, date: string, tags: string[] = []) =>
  ({ slug, date, tags, title: slug, excerpt: '' }) as unknown as BlogPost;

const posts = [
  post('a', '2026-06-01', ['Bitcoin']),
  post('b', '2026-06-01', ['BiasLens']),
  post('c', '2026-05-15', ['Bitcoin']),
];

describe('the blog filters', () => {
  // vitest.setup replaces window.location with a plain object.
  const at = (search: string) => {
    window.location.search = search;
    window.location.href = `http://localhost:3000/blog${search}`;
  };
  afterEach(() => at(''));

  it('files a post under the month written in its date, in any time zone', () => {
    expect(postMonth('2026-06-01')).toBe('2026-06');

    const { result } = renderHook(() => useBlogFilters(posts));
    const months = result.current.timeFilterOptions.filter(o => /^\d{4}-\d{2}$/.test(o.key));
    expect(months).toEqual([
      { key: '2026-06', label: 'June 2026', count: 2 },
      { key: '2026-05', label: 'May 2026', count: 1 },
    ]);
    act(() => result.current.setSelectedTimeFilter('2026-05'));
    expect(result.current.postsToShow.map(p => p.slug)).toEqual(['c']);
  });

  it('opens filtered to the tag in the URL, matched in any case', () => {
    at('?tag=biaslens');
    const { result } = renderHook(() => useBlogFilters(posts));
    expect(result.current.selectedTag).toBe('BiasLens');
    expect(result.current.postsToShow.map(p => p.slug)).toEqual(['b']);
  });

  it('keeps the URL in step with the chosen tag', () => {
    at('');
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useBlogFilters(posts));
    act(() => result.current.setSelectedTag('Bitcoin'));
    expect(String(replace.mock.calls.at(-1)?.[2])).toBe('http://localhost:3000/blog?tag=Bitcoin');
    act(() => result.current.clearFilters());
    expect(String(replace.mock.calls.at(-1)?.[2])).toBe('http://localhost:3000/blog');
    replace.mockRestore();
  });
});
