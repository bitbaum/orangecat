// @vitest-environment jsdom
/**
 * A reply written by the agent has to say so.
 *
 * `is_cat_reply: true` was stamped onto every Cat reply, under a comment saying
 * it was "marked so the UI can render a Cat reply distinctly rather than
 * leaving a reader to work out from the avatar that this one was written by an
 * agent". Nothing read it — two writers, zero readers — so an answer from the
 * Cat looked exactly like an answer from a person, unless you happened to
 * recognise the handle.
 *
 * That is the difference that matters when copying how @grok works: the model's
 * replies are visibly the model's. Attribution of machine-written text to a
 * human reader is not a styling detail.
 */

import { render, screen } from '@testing-library/react';
import { PostHeader } from '@/components/timeline/PostHeader';
import type { TimelineDisplayEvent } from '@/types/timeline';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function postBy(username: string, extra: Partial<TimelineDisplayEvent> = {}): TimelineDisplayEvent {
  return {
    id: 'e1',
    actor: { id: 'a1', name: username === 'cat' ? 'Cat' : 'A Person', username, type: 'user' },
    eventTimestamp: new Date().toISOString(),
    ...extra,
  } as unknown as TimelineDisplayEvent;
}

describe('a Cat reply is labelled', () => {
  it('marks a post authored by the Cat', () => {
    render(<PostHeader event={postBy('cat')} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('marks a reply flagged as the Cat even if attribution changes', () => {
    render(<PostHeader event={postBy('someone', { metadata: { is_cat_reply: true } })} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('leaves an ordinary person unmarked', () => {
    render(<PostHeader event={postBy('mao')} />);
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
  });

  it('is not fooled by a handle that merely starts with cat', () => {
    // `catalogue` must not be badged as the platform agent — the same rule the
    // mention menu applies when deciding what @cat means.
    render(<PostHeader event={postBy('catalogue')} />);
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
  });
});
