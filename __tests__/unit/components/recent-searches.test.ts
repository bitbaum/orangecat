// @vitest-environment jsdom
import {
  RECENT_LIMIT,
  forgetRecents,
  readRecents,
  rememberRecent,
  withRecent,
} from '@/components/search/recent-searches';

describe('recent searches', () => {
  beforeEach(() => window.localStorage.clear());

  it('puts the latest first, once, and keeps a handful', () => {
    let list = withRecent([], { kind: 'search', label: 'a', href: '/discover?q=a' });
    list = withRecent(list, { kind: 'hit', label: 'Loki', href: '/projects/1', type: 'project' });
    list = withRecent(list, { kind: 'search', label: 'a', href: '/discover?q=a' });
    expect(list.map(e => e.label)).toEqual(['a', 'Loki']);
    for (let i = 0; i < 10; i++) {
      list = withRecent(list, { kind: 'search', label: `${i}`, href: `/discover?q=${i}` });
    }
    expect(list).toHaveLength(RECENT_LIMIT);
  });

  it('round-trips through storage and ignores anything that is not a local link', () => {
    rememberRecent({ kind: 'search', label: 'zürich', href: '/discover?q=z%C3%BCrich' });
    window.localStorage.setItem(
      'oc:recent-searches',
      JSON.stringify([...readRecents(), { kind: 'hit', label: 'x', href: 'https://evil.example' }])
    );
    expect(readRecents().map(e => e.label)).toEqual(['zürich']);
    forgetRecents();
    expect(readRecents()).toEqual([]);
  });
});
