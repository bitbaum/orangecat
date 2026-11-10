/**
 * A project's wall shows posts written on it and posts its authors also put
 * there (a `project` visibility context) — the second half is what makes
 * cross-posted short posts and "Also post on" articles appear at all.
 */
import { projectWallFilter } from '@/services/timeline/queries/project-wall-filter';

const PROJECT = 'p-1';

describe('projectWallFilter', () => {
  it('matches the wall by subject and by context, public only when signed out', () => {
    expect(projectWallFilter(PROJECT, ['e1', 'e2'], null)).toBe(
      'and(visibility.eq.public,or(and(subject_type.eq.project,subject_id.eq.p-1),id.in.(e1,e2)))'
    );
  });

  it('lets a signed-in viewer see their own non-public posts', () => {
    expect(projectWallFilter(PROJECT, [], 'u-1')).toBe(
      'and(or(visibility.eq.public,actor_id.eq.u-1),or(and(subject_type.eq.project,subject_id.eq.p-1)))'
    );
  });
});
