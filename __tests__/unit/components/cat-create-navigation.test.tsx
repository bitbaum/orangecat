// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { catAnswer } from '@/lib/chat/cat-messages';
import { CreateNavigation } from '@/components/ai-chat/ModernChatPanel/components/CreateNavigation';

it('makes the deployed plain-path answer actionable and deduplicates editor replies', () => {
  const answer = catAnswer({
    content: 'The article editor is at **/articles/new** — click that link.',
    quickReplies: [
      'Open article editor',
      'Show me article editor',
      'Start new article',
      'Help me outline',
    ],
  });
  // The reply that says something stays a chatkit reply button…
  expect(answer.replies).toEqual(['Help me outline']);
  // …and the ones that open a page become one link.
  render(<CreateNavigation content={answer.content} replies={answer.destinations} />);
  expect(screen.getAllByRole('link', { name: 'Open article editor' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Open article editor' })).toHaveAttribute(
    'href',
    '/articles/new'
  );
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
