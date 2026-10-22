import type { KeyboardEvent } from 'react';
import type { MarkdownActions } from './useMarkdownTextarea';

/** Keyboard bindings shared by the article editor's write surface. */
export function handleArticleKeyDown(
  e: KeyboardEvent<HTMLTextAreaElement>,
  md: MarkdownActions,
  saveDraft: () => unknown
) {
  if (!(e.metaKey || e.ctrlKey)) {
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'b') {
    e.preventDefault();
    md.wrap('**', '**', 'bold');
  } else if (k === 'i') {
    e.preventDefault();
    md.wrap('*', '*', 'italic');
  } else if (k === 'k') {
    e.preventDefault();
    md.insertLink();
  } else if (k === 's') {
    // Flush the draft now instead of letting the browser offer to save the page.
    e.preventDefault();
    saveDraft();
  }
}
