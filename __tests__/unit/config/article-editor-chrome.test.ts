import { getRouteChrome, getRouteSurface, isArticleEditorPath } from '@/config/routes';

it.each([
  '/articles/new',
  '/articles/new/',
  '/articles/my-article/edit',
  '/articles/my-article/edit/',
])('gives %s application chrome with a focused writing workspace', path => {
  expect(isArticleEditorPath(path)).toBe(true);
  expect(getRouteSurface(path)).toBe('app');
  expect(getRouteChrome(path)).toMatchObject({
    hideMobileBottomNav: true,
    hideGlobalCat: true,
    preferCollapsedSidebar: true,
    immersiveChat: false,
  });
});
it.each(['/articles', '/articles/a-published-piece', '/articles/not-editing'])(
  'keeps %s public',
  path => {
    expect(isArticleEditorPath(path)).toBe(false);
    expect(getRouteSurface(path)).toBe('public');
  }
);
