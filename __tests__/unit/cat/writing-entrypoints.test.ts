import { buildCatSystemPrompt } from '@/services/cat/system-prompt';
import { ROUTES } from '@/config/routes';

it.each(['prose', 'tools', 'none'] as const)(
  'preserves real writing destinations in %s mode',
  actionsVia => {
    const prompt = buildCatSystemPrompt({ actionsVia, turnDescriptor: 'I wanna write an article' });
    expect(prompt).toContain(`[Write an article](${ROUTES.ARTICLES_NEW})`);
    expect(prompt).toContain(`${ROUTES.TIMELINE}?compose=true`);
    expect(prompt).toContain('No project required.');
    expect(prompt).not.toContain('/post/new');
  }
);
