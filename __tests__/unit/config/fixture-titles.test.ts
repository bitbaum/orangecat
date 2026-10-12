/**
 * Listings that say they are test data stay off public directories.
 *
 * On 2026-10-12 the first card on /discover was "TEST Session (60 min) — TEST
 * fixture — safe to delete", made by hand from a real account, so no username
 * rule could catch it. The title rule is case-sensitive on purpose: a shouted
 * marker is a fixture, an ordinary word is not.
 */

import {
  FIXTURE_TITLE_LIKE_PATTERNS,
  isFixtureTitle,
  withoutFixtureTitles,
} from '@/config/public-directory';

describe('isFixtureTitle', () => {
  it.each(['TEST Session (60 min)', 'TEST: checkout', 'E2E reset group', 'E2E:wf-1'])(
    'catches %s',
    title => {
      expect(isFixtureTitle(title)).toBe(true);
    }
  );

  it.each([
    'Test prep tutoring',
    'Testing the waters — a pottery class',
    'TESTAMENT reading circle',
    'A TEST of patience',
    '',
    null,
  ])('leaves %s alone', title => {
    expect(isFixtureTitle(title)).toBe(false);
  });
});

describe('withoutFixtureTitles', () => {
  it('adds one not-like filter per pattern, on the column it is given', () => {
    const calls: Array<[string, string, unknown]> = [];
    const query = {
      not(column: string, operator: string, value: unknown) {
        calls.push([column, operator, value]);
        return query;
      },
    };
    expect(withoutFixtureTitles(query, 'name')).toBe(query);
    expect(calls).toEqual(FIXTURE_TITLE_LIKE_PATTERNS.map(p => ['name', 'like', p]));
  });

  it('agrees with isFixtureTitle on every pattern', () => {
    for (const pattern of FIXTURE_TITLE_LIKE_PATTERNS) {
      expect(isFixtureTitle(pattern.replace('%', 'anything'))).toBe(true);
    }
  });
});
