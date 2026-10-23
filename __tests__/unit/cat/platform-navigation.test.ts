import {
  buildPlatformNavigationContext,
  supportedCreateLinksIn,
} from '@/services/cat/platform-navigation';
import { CREATE_OPTIONS } from '@/config/create-options';

it('grounds writing destinations in the same catalog as Create', () => {
  const context = buildPlatformNavigationContext();
  for (const option of CREATE_OPTIONS.filter(option => option.category === 'content')) {
    expect(context).toContain(`[${option.name}](${option.href})`);
    expect(context).toContain(option.description);
  }
  expect(context).toContain('even for an empty profile');
  expect(context).toContain("unknown facts about the user's records");
});
it('protects real navigation links without licensing invented destinations', () => {
  expect([
    ...supportedCreateLinksIn(
      '[Article](/articles/new) [Fake](/post/new) [Injected](/articles/new?redirect=https://evil.example) [External](https://evil.example)'
    ),
  ]).toEqual(['/articles/new']);
});
