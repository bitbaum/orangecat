import {
  buildPlatformNavigationContext,
  supportedCreateLinksIn,
} from '@/services/cat/platform-navigation';
import { CREATE_OPTIONS } from '@/config/create-options';
import { ROUTES } from '@/config/routes';
import { composeCatMessages } from '@/services/cat/prompt-budget';

it('grounds writing destinations in the same catalog as Create', () => {
  const context = buildPlatformNavigationContext();
  for (const option of CREATE_OPTIONS.filter(option => option.category === 'content')) {
    expect(context).toContain(`[${option.name}](${option.href})`);
    expect(context).toContain(option.description);
  }
  expect(context).toContain('even for an empty profile');
  expect(context).toContain("unknown facts about the user's records");
});

it('offers investor-room links only for projects actually fetched for this user', () => {
  const context = buildPlatformNavigationContext([
    { id: 'project-one', type: 'project', title: 'First venture', status: 'draft' },
    { id: 'asset-one', type: 'asset', title: 'Camera', status: 'active' },
  ]);
  expect(context).toContain(ROUTES.PROJECTS.ROOM('project-one'));
  expect(context).not.toContain(ROUTES.PROJECTS.ROOM('asset-one'));
  expect(context).toContain('ask which one');
  expect(buildPlatformNavigationContext()).toContain(ROUTES.DASHBOARD.PROJECTS);
  expect(buildPlatformNavigationContext()).toContain('do not claim none exists');
});

it('protects a fetched room link during repair without trusting invented room links', () => {
  const known = ROUTES.PROJECTS.ROOM('project-one');
  const invented = ROUTES.PROJECTS.ROOM('someone-else');
  const content = `[Open room](${known}) [Invented](${invented})`;
  expect([...supportedCreateLinksIn(content, [`Project room: ${known}`])]).toEqual([known]);
  expect([...supportedCreateLinksIn(content)]).toEqual([]);
});

it('retains application navigation when the budget removes all personal context', () => {
  const navigation = buildPlatformNavigationContext();
  const messages = composeCatMessages(
    {
      base: 'Cat',
      standingInstructions: '',
      userContext: 'Private profile',
      groundingRules: 'Rules about personal context',
      platformNavigation: navigation,
      fewShot: '',
      languageDirective: '',
      history: [],
      message: 'Open my investor room',
    },
    { history: [], includeFewShot: false, contextChars: 0 }
  );
  expect(messages[0].content).toContain(navigation);
  expect(messages[0].content).not.toContain('Private profile');
  expect(messages[0].content).not.toContain('Rules about personal context');
});
it('protects real navigation links without licensing invented destinations', () => {
  expect([
    ...supportedCreateLinksIn(
      '[Article](/articles/new) [Fake](/post/new) [Injected](/articles/new?redirect=https://evil.example) [External](https://evil.example)'
    ),
  ]).toEqual(['/articles/new']);
});
