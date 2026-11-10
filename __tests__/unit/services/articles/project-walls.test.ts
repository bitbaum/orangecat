/**
 * An article can also go on the walls of the writer's own projects. These pin
 * the two decisions that make that safe: which walls `publishArticle` writes
 * (only projects the writer owns, the list short posts cross-post to) and which
 * project a sister product's `?project=` link preselects.
 */
import { ownedProjectIds, resolveProjectParam } from '@/services/articles/project-walls';
import { buildTimelineContexts } from '@/services/timeline/utils/timeline-contexts';

const createEventWithVisibility = vi.fn();
const fetchUserProjects = vi.fn();

vi.mock('@/services/timeline', () => ({
  timelineService: {
    createEventWithVisibility: (...args: unknown[]) => createEventWithVisibility(...args),
  },
}));
vi.mock('@/services/timeline/utils/post-composer', () => ({
  fetchUserProjects: (...args: unknown[]) => fetchUserProjects(...args),
}));

const SOLON = { id: '11111111-1111-4111-8111-111111111111', title: 'Solon' };
const IDEAS = { id: '22222222-2222-4222-8222-222222222222', title: 'Ideas & Drafts' };
const SOMEONE_ELSES = '33333333-3333-4333-8333-333333333333';
const USER = { id: 'user-1' };

const article = {
  title: 'Why governance needs signatures',
  body: 'A long-form body.',
  visibility: 'public' as const,
};

beforeEach(() => {
  createEventWithVisibility.mockReset().mockResolvedValue({ success: true });
  fetchUserProjects.mockReset().mockResolvedValue([SOLON, IDEAS]);
});

describe('publishArticle walls', () => {
  it('posts on the profile, each owned project chosen, and the community feed', async () => {
    const { publishArticle } = await import('@/services/articles/create');
    const result = await publishArticle(USER, { ...article, projectIds: [SOLON.id, IDEAS.id] });

    expect(result.success).toBe(true);
    expect(createEventWithVisibility.mock.calls[0][0].timelineContexts).toEqual([
      { timeline_type: 'profile', timeline_owner_id: USER.id },
      { timeline_type: 'project', timeline_owner_id: SOLON.id },
      { timeline_type: 'project', timeline_owner_id: IDEAS.id },
      { timeline_type: 'community', timeline_owner_id: null },
    ]);
  });

  it('drops a project the writer does not own, and duplicates', async () => {
    const { publishArticle } = await import('@/services/articles/create');
    await publishArticle(USER, {
      ...article,
      visibility: 'followers',
      projectIds: [SOMEONE_ELSES, SOLON.id, SOLON.id],
    });

    expect(fetchUserProjects).toHaveBeenCalledWith(USER.id);
    expect(createEventWithVisibility.mock.calls[0][0].timelineContexts).toEqual([
      { timeline_type: 'profile', timeline_owner_id: USER.id },
      { timeline_type: 'project', timeline_owner_id: SOLON.id },
    ]);
  });

  it('does not look up projects when none were chosen', async () => {
    const { publishArticle } = await import('@/services/articles/create');
    await publishArticle(USER, article);

    expect(fetchUserProjects).not.toHaveBeenCalled();
    expect(createEventWithVisibility.mock.calls[0][0].timelineContexts).toEqual([
      { timeline_type: 'profile', timeline_owner_id: USER.id },
      { timeline_type: 'community', timeline_owner_id: null },
    ]);
  });
});

describe('buildTimelineContexts (shared with short posts)', () => {
  it('adds one project wall per chosen project and no community feed for a reply', () => {
    expect(buildTimelineContexts('profile', undefined, 'u', ['p1'], 'public', 'parent')).toEqual([
      { timeline_type: 'profile', timeline_owner_id: 'u' },
      { timeline_type: 'project', timeline_owner_id: 'p1' },
    ]);
  });
});

describe('resolveProjectParam (?project=)', () => {
  const owned = [SOLON, IDEAS];

  it('selects an owned project by id', () => {
    expect(resolveProjectParam(SOLON.id, owned)).toBe(SOLON.id);
  });

  it('selects an owned project by the slug of its title, in any case', () => {
    expect(resolveProjectParam('solon', owned)).toBe(SOLON.id);
    expect(resolveProjectParam('Solon', owned)).toBe(SOLON.id);
    expect(resolveProjectParam('ideas-drafts', owned)).toBe(IDEAS.id);
  });

  it('selects nothing for a project that is not the writer’s', () => {
    expect(resolveProjectParam(SOMEONE_ELSES, owned)).toBeNull();
    expect(resolveProjectParam('biaslens', owned)).toBeNull();
    expect(resolveProjectParam('solon', [])).toBeNull();
  });

  it('selects nothing when the link names no project', () => {
    expect(resolveProjectParam(null, owned)).toBeNull();
    expect(resolveProjectParam('   ', owned)).toBeNull();
    expect(resolveProjectParam('!!!', owned)).toBeNull();
  });
});

describe('ownedProjectIds', () => {
  it('keeps owned ids once, in the order asked', () => {
    expect(ownedProjectIds([IDEAS.id, SOMEONE_ELSES, SOLON.id, IDEAS.id], [SOLON, IDEAS])).toEqual([
      IDEAS.id,
      SOLON.id,
    ]);
    expect(ownedProjectIds(undefined, [SOLON])).toEqual([]);
  });
});
