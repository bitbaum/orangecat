import { getContextualCreateType } from '@/lib/navigation/contextual-create';
import { CREATE_OPTIONS } from '@/config/create-options';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';

// The tab bar's plus is always "Create" and always opens the sheet. The page
// only decides which kind the sheet offers first.
it.each([ROUTES.DASHBOARD.HOME, ROUTES.TIMELINE, ROUTES.MESSAGES, ROUTES.DISCOVER])(
  '%s suggests no kind, so the sheet leads with writing',
  pathname => {
    expect(getContextualCreateType(pathname)).toBeUndefined();
    expect(CREATE_OPTIONS.map(option => option.href)).toEqual(
      expect.arrayContaining([ROUTES.ARTICLES_NEW, `${ROUTES.TIMELINE}?compose=true`])
    );
  }
);

it('suggests the kind whose list is open, and its pages', () => {
  const groups = ENTITY_REGISTRY.group.basePath;
  expect(getContextualCreateType(groups)).toBe('group');
  expect(getContextualCreateType(`${groups}/some-slug`)).toBe('group');
});

it('does not match a path that merely starts with the same letters', () => {
  expect(getContextualCreateType(`${ENTITY_REGISTRY.group.basePath}-archive`)).toBeUndefined();
});
