// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostContent } from '@/components/timeline/PostContent';
import type { TimelineDisplayEvent } from '@/types/timeline';

const event = {
  id: 'external1',
  title: 'Improved the chat controls',
  displayType: 'Project Updated',
  actor: { id: 'actor', name: 'Cato', username: 'cato' },
  description: 'PR #1356 is running. Next: wait for the checks. Full original text.',
  metadata: {
    is_external_publish: true,
    source: 'loki',
    source_url: 'https://loki.orangecat.ch/projects/chat',
  },
} as unknown as TimelineDisplayEvent;

it('keeps source provenance and the full original update behind a native disclosure', async () => {
  const { container } = render(<PostContent event={event} />);
  expect(screen.getByText('Improved the chat controls')).toBeVisible();
  expect(screen.getByRole('link', { name: /via Loki/ })).toHaveAttribute(
    'href',
    event.metadata?.source_url
  );
  const details = container.querySelector('details')!;
  expect(details.open).toBe(false);
  expect(screen.getByText(event.description!)).not.toBeVisible();
  await userEvent.click(screen.getByText('Read update'));
  expect(details.open).toBe(true);
  expect(screen.getByText(event.description!)).toBeVisible();
});
it('leaves an ordinary author-written post readable without disclosure', () => {
  const { container } = render(
    <PostContent event={{ ...event, metadata: { is_user_post: true } }} />
  );
  expect(screen.getByText(event.description!)).toBeVisible();
  expect(container.querySelector('details')).toBeNull();
});
