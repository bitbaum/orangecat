// @vitest-environment jsdom
/**
 * The composer must empty itself after a post — including when it still has
 * focus.
 *
 * This is the bug that made Ctrl+Enter look broken in production. The shortcut
 * worked and the post was created; the composer simply kept showing the text,
 * because the effect that syncs `content` into the contentEditable bailed out
 * whenever the editor was the active element — which it always is right after
 * you press a key in it. So the natural response was to press again, and the
 * server rejected that as a duplicate ("You just posted this"), which looked
 * like a second failure.
 *
 * Clicking the button never showed it: a click moves focus to the button first,
 * so the guard did not apply. A shortcut and a button that disagree about
 * whether the composer clears is the shape worth pinning here.
 */

import { renderHook, act } from '@testing-library/react';
import { useContentEditableEditor } from '@/hooks/useContentEditableEditor';

vi.mock('@/utils/markdownEditor', () => ({
  markdownToHtml: (md: string) => md,
  htmlToMarkdown: (html: string) => html,
  getSelectionRange: () => ({ start: 0, end: 0 }),
  setSelectionRange: vi.fn(),
}));

/**
 * Mount the hook and give it a real element to own. `tabIndex` is what makes a
 * div focusable in jsdom — without it `focus()` is a no-op and the guard under
 * test would never engage, so the test would pass for the wrong reason.
 */
function mount(initial: string) {
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.tabIndex = 0;
  document.body.appendChild(editor);

  const view = renderHook(
    ({ content }: { content: string }) =>
      useContentEditableEditor({ content, onContentChange: vi.fn() }),
    { initialProps: { content: initial } }
  );

  act(() => {
    view.result.current.editorRef.current = editor;
  });

  return { editor, rerender: view.rerender };
}

describe('useContentEditableEditor content sync', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('clears the editor when content is reset while it still has focus', () => {
    const { editor, rerender } = mount('a draft');
    editor.innerHTML = 'a draft';
    editor.focus();
    // Guard the guard: if focus did not take, this test proves nothing.
    expect(document.activeElement).toBe(editor);

    // What a successful post does: content state goes back to empty.
    act(() => rerender({ content: '' }));

    expect(editor.textContent?.trim()).toBe('');
  });

  it('still refuses to overwrite text being typed while focused', () => {
    // The relaxed guard exists for a real reason, and only the empty case is
    // exempt — an external change to non-empty text must not clobber a
    // half-written post.
    const { editor, rerender } = mount('');
    editor.innerHTML = 'what I am typing';
    editor.focus();
    expect(document.activeElement).toBe(editor);

    act(() => rerender({ content: 'something the app decided' }));

    expect(editor.textContent).toBe('what I am typing');
  });
});
