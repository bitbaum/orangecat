// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateNavigation } from '@/components/ai-chat/ModernChatPanel/components/CreateNavigation';

it('makes the deployed plain-path answer actionable and deduplicates editor replies', () => {
  const reply = vi.fn();
  render(
    <CreateNavigation
      content="The article editor is at **/articles/new** — click that link."
      replies={[
        'Open article editor',
        'Show me article editor',
        'Start new article',
        'Help me outline',
      ]}
      onQuickReply={reply}
    />
  );
  expect(screen.getAllByRole('link', { name: 'Open article editor' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Open article editor' })).toHaveAttribute(
    'href',
    '/articles/new'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Help me outline' }));
  expect(reply).toHaveBeenCalledWith('Help me outline');
  expect(reply).toHaveBeenCalledTimes(1);
});

it.each([
  '/articles/new?next=https://example.com',
  '/articles/new/unknown',
  '/articles/new.json',
  'https://example.com/articles/new',
  '/post/new',
])('does not turn an unknown path into a catalog action: %s', content => {
  render(<CreateNavigation content={content} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
