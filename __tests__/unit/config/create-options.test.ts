import { CREATE_OPTIONS, CREATE_PAGE } from '@/config/create-options';
import { getEntitiesForCreateMenu } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';

const NON_ENTITY_OPTIONS = [ROUTES.DASHBOARD.STUDIO, '/timeline?compose=true'];

describe('CREATE_OPTIONS', () => {
  it('leads with the Studio and a post, then every registry create path', () => {
    // The Studio leads because making the thing comes before listing it; the
    // post is second. Neither creates a row, which is why they are spelled out
    // here rather than derived from the entity registry.
    expect(CREATE_OPTIONS.slice(0, NON_ENTITY_OPTIONS.length).map(o => o.href)).toEqual(
      NON_ENTITY_OPTIONS
    );
    const hrefs = CREATE_OPTIONS.slice(NON_ENTITY_OPTIONS.length).map(option => option.href);
    expect(hrefs).toEqual(getEntitiesForCreateMenu().map(entity => entity.createPath));
  });

  it('does not collapse the chooser into project-create only', () => {
    expect(CREATE_PAGE.title).toMatch(/create/i);
    expect(CREATE_OPTIONS.some(option => option.href.includes('/store/create'))).toBe(true);
    expect(CREATE_OPTIONS.filter(option => option.href.includes('/projects/create'))).toHaveLength(
      1
    );
  });
});
