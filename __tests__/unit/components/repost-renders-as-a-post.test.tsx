// @vitest-environment jsdom
/**
 * A repost is shown as the post it is; a quote repost shows two posts.
 *
 * A simple repost used to suppress its own content and render the original
 * inside a bordered panel instead — a panel repeating the original author's
 * avatar and handle, which the post header directly above was ALREADY showing
 * (PostCard swaps the reposter for the original author on a simple repost).
 * One repost drew the same person twice, two lines apart, with the actual text
 * boxed off underneath.
 *
 * The distinction these tests hold: a SIMPLE repost has one author and one
 * body, so it renders flat. A QUOTE repost genuinely has two of each, so it
 * keeps the nested panel. Collapsing both cases the same way would be the
 * opposite bug.
 *
 * Found live in production, one field over from the first bug: `usePostRepost`
 * sets `subjectType: 'profile', subjectId: userId` on EVERY repost — simple
 * or quote — purely to satisfy `createEvent`'s required fields. It always
 * resolves to the REPOSTER's own profile, so `event.subject` on a repost is
 * plumbing, never content. Rendered anyway, it showed as a second, unlabeled
 * name directly under the post body — the same header repeated a third time,
 * in a place with no visual explanation for why it was there.
 */

import { render, screen } from '@testing-library/react';
import { PostContent } from '@/components/timeline/PostContent';
import type { TimelineDisplayEvent } from '@/types/timeline';

vi.mock('@/utils/markdown', () => ({
  renderMarkdownToReact: (text: string) => text,
}));

const base = {
  id: 'e1',
  actor: { id: 'a1', name: 'Reposter', username: 'reposter', type: 'user' },
  description: '',
  metadata: {},
  // The shape usePostRepost actually produces: subjectType/subjectId set to
  // the reposter's own profile to satisfy createEvent, resolved by
  // enrichment into a subject that points right back at the byline.
  subject: { id: 'a1', name: 'Reposter', url: '/profiles/reposter', type: 'profile' },
} as unknown as TimelineDisplayEvent;

function simpleRepost(): TimelineDisplayEvent {
  return {
    ...base,
    description: '',
    metadata: {
      is_repost: true,
      original_event_id: 'orig-1',
      original_actor_name: 'Original Author',
      original_actor_username: 'original',
      original_description: 'The original words.',
    },
  } as unknown as TimelineDisplayEvent;
}

function quoteRepost(): TimelineDisplayEvent {
  return {
    ...base,
    description: 'My take on this.',
    metadata: {
      is_repost: true,
      is_quote_repost: true,
      original_event_id: 'orig-1',
      original_actor_name: 'Original Author',
      original_actor_username: 'original',
      original_description: 'The original words.',
    },
  } as unknown as TimelineDisplayEvent;
}

function ordinaryPost(): TimelineDisplayEvent {
  return {
    ...base,
    description: 'Shipped a new feature today.',
    metadata: {},
    subject: { id: 'proj-1', name: 'Loki', url: '/projects/loki', type: 'project' },
  } as unknown as TimelineDisplayEvent;
}

describe('a simple repost', () => {
  it('shows the original text as the post body', () => {
    render(<PostContent event={simpleRepost()} />);

    expect(screen.getByText('The original words.')).toBeInTheDocument();
  });

  it('does not repeat the original author, who is already in the header', () => {
    render(<PostContent event={simpleRepost()} />);

    // PostCard renders the original author in the post header for a simple
    // repost. PostContent must not draw them a second time.
    expect(screen.queryByText('Original Author')).not.toBeInTheDocument();
    expect(screen.queryByText('@original')).not.toBeInTheDocument();
  });

  it('does not render the reposter as a second, unlabeled subject link', () => {
    render(<PostContent event={simpleRepost()} />);

    // `event.subject` on this fixture resolves to the reposter's own profile
    // — plumbing, not content. It must not appear as a link under the body.
    expect(screen.queryByRole('link', { name: 'Reposter' })).not.toBeInTheDocument();
  });
});

describe('an ordinary (non-repost) post', () => {
  it('still shows a genuine subject link', () => {
    render(<PostContent event={ordinaryPost()} />);

    // The suppression is specific to reposts. A real post's subject — e.g.
    // "posted about Loki" — must keep rendering.
    expect(screen.getByRole('link', { name: 'Loki' })).toBeInTheDocument();
  });
});

describe('a quote repost', () => {
  it('shows the quoter’s own words as the post body', () => {
    render(<PostContent event={quoteRepost()} />);

    expect(screen.getByText('My take on this.')).toBeInTheDocument();
  });

  it('keeps the quoted original in its own panel, author and all', () => {
    render(<PostContent event={quoteRepost()} />);

    // Two posts, two authors: here the panel earns its place.
    expect(screen.getByText('Original Author')).toBeInTheDocument();
    expect(screen.getByText('The original words.')).toBeInTheDocument();
  });

  it('does not ALSO render the reposter as an unlabeled subject link', () => {
    render(<PostContent event={quoteRepost()} />);

    // usePostRepost sets the same self-referential subject on quote reposts
    // as on simple ones. The quoter's name is already the byline; it must
    // not also appear as a bare link below the quoted panel.
    expect(screen.queryByRole('link', { name: 'Reposter' })).not.toBeInTheDocument();
  });
});
