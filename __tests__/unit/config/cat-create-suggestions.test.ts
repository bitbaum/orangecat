import { getCreateSuggestionHref } from '@/config/cat-create-suggestions';

it('opens the real article and short-post destinations from route chips', () => {
  expect(getCreateSuggestionHref('Open /articles/new')).toBe('/articles/new');
  expect(getCreateSuggestionHref('open /timeline?compose=true')).toBe('/timeline?compose=true');
});

it.each([
  'Open /post/new',
  'Open //example.com',
  'Open https://example.com',
  'Open /articles/new?next=https://example.com',
  'Show me the editor UI',
  '',
])('leaves unrecognized suggestions as conversation: %s', text => {
  expect(getCreateSuggestionHref(text)).toBeNull();
});
