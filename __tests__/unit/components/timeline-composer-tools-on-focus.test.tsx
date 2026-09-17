// @vitest-environment jsdom
/**
 * The composer's tools appear when you compose, and survive being clicked.
 *
 * At rest the composer showed six controls around an empty box — an AI
 * drafter, an image picker and three visibility chips — all of them for a post
 * nobody had written yet. They now appear on focus.
 *
 * The second test is the one that matters. The standard way this pattern
 * breaks is that focus leaves the editor on mousedown, the toolbar unmounts
 * before the click lands, and the button silently does nothing — a bug that
 * looks like "the AI button is broken" and never appears in a render-only
 * test. The component checks `relatedTarget` on blur to stay mounted while
 * focus moves inside itself; this asserts that it does.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import TimelineComposer from '@/components/timeline/TimelineComposer';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.c', user_metadata: {} },
    profile: { username: 'mao', name: 'Mao', avatar_url: null },
  }),
}));

const composerState = {
  content: '',
  setContent: vi.fn(),
  isPosting: false,
  handlePost: vi.fn(),
  visibility: 'public' as const,
  setVisibility: vi.fn(),
  image: null,
  setImage: vi.fn(),
  error: null,
  postSuccess: false,
  userProjects: [],
  selectedProjects: [],
  toggleProjectSelection: vi.fn(),
};

vi.mock('@/hooks/usePostComposerNew', () => ({
  usePostComposer: () => composerState,
}));

vi.mock('@/hooks/useContentEditableEditor', () => ({
  useContentEditableEditor: () => ({
    editorRef: { current: null },
    handleInput: vi.fn(),
    handlePaste: vi.fn(),
    handleKeyDown: vi.fn(),
    handleFormat: vi.fn(),
  }),
}));

vi.mock('@/components/mentions/useContentEditableMentions', () => ({
  useContentEditableMentions: () => ({ editorProps: {}, menuProps: { suggestions: [] } }),
}));

vi.mock('@/components/mentions/MentionSuggestions', () => ({
  __esModule: true,
  default: () => null,
}));

// The AI drafter stands in for "a toolbar button": focusing it must not
// unmount the toolbar it lives in.
vi.mock('@/components/timeline/PostAiButton', () => ({
  __esModule: true,
  default: () => (
    <button type="button" aria-label="Write with AI">
      Write with AI
    </button>
  ),
}));
vi.mock('@/components/timeline/ReplyAiButton', () => ({ __esModule: true, default: () => null }));
vi.mock('@/components/timeline/PostAiEditMenu', () => ({ __esModule: true, default: () => null }));

const AI_BUTTON = /write with ai/i;

describe('composer tools appear on focus', () => {
  beforeEach(() => {
    composerState.content = '';
    composerState.image = null;
  });

  it('stays out of the way until the composer is focused', () => {
    render(<TimelineComposer />);

    expect(screen.queryByLabelText(AI_BUTTON)).not.toBeInTheDocument();

    // The primary action is never hidden behind a focus.
    expect(screen.getByRole('button', { name: /share update|post/i })).toBeInTheDocument();
  });

  it('reveals the tools once focused', () => {
    render(<TimelineComposer />);

    fireEvent.focus(screen.getByLabelText('Compose new post'));

    expect(screen.getByLabelText(AI_BUTTON)).toBeInTheDocument();
  });

  it('does NOT collapse when focus moves from the editor to a tool', () => {
    render(<TimelineComposer />);

    const editor = screen.getByLabelText('Compose new post');
    fireEvent.focus(editor);
    const aiButton = screen.getByLabelText(AI_BUTTON);

    // Focus leaving the editor FOR the button — relatedTarget is inside the
    // composer, so the toolbar must survive. Without the relatedTarget check
    // the button unmounts here and the click never lands.
    fireEvent.blur(editor, { relatedTarget: aiButton });

    expect(screen.getByLabelText(AI_BUTTON)).toBeInTheDocument();
  });

  it('collapses when focus leaves the composer entirely', () => {
    render(<TimelineComposer />);

    const editor = screen.getByLabelText('Compose new post');
    fireEvent.focus(editor);
    expect(screen.getByLabelText(AI_BUTTON)).toBeInTheDocument();

    fireEvent.blur(editor, { relatedTarget: document.body });

    expect(screen.queryByLabelText(AI_BUTTON)).not.toBeInTheDocument();
  });

  it('stays open while there is a draft, focused or not', () => {
    composerState.content = 'half a thought';
    render(<TimelineComposer />);

    // Never focused, but there is something to act on.
    expect(screen.getByLabelText(AI_BUTTON)).toBeInTheDocument();
  });
});
