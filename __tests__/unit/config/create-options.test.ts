import { CREATE_OPTIONS, CREATE_PAGE } from '@/config/create-options';
import { getEntitiesForCreateMenu } from '@/config/entity-registry';

describe('CREATE_OPTIONS', () => {
  it('starts with a post, then every registry create path', () => {
    expect(CREATE_OPTIONS[0]?.href).toBe('/timeline?compose=true');
    const hrefs = CREATE_OPTIONS.slice(1).map(option => option.href);
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
