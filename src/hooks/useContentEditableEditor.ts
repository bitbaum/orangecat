import { useRef, useState, useCallback, useEffect } from 'react';
import {
  markdownToHtml,
  htmlToMarkdown,
  getSelectionRange,
  setSelectionRange,
} from '@/utils/markdownEditor';

interface UseContentEditableEditorOptions {
  content: string;
  onContentChange: (markdown: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  maxHeight?: number;
  disabled?: boolean;
  sanitizer?: (html: string) => string;
  /** When set, pasted image files are handed here instead of being dropped. */
  onPasteFiles?: (files: File[]) => void;
}

interface UseContentEditableEditorReturn {
  editorRef: React.RefObject<HTMLDivElement | null>;
  handleInput: () => void;
  handlePaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  handleFormat: (format: 'bold' | 'italic') => void;
  isComposing: boolean;
}

export function useContentEditableEditor({
  content,
  onContentChange,
  onSubmit,
  onCancel,
  maxHeight = 480,
  disabled = false,
  sanitizer,
  onPasteFiles,
}: UseContentEditableEditorOptions): UseContentEditableEditorReturn {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  const sanitize = useCallback((html: string) => (sanitizer ? sanitizer(html) : html), [sanitizer]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || isComposing) {
      return;
    }

    // Normally an external content change must not overwrite what someone is
    // actively typing, so a focused editor is left alone. Being RESET to empty
    // is the exception, and it has to be: that is what a successful post does,
    // and after Ctrl+Enter the editor still has focus.
    //
    // Without this exception the composer kept the text of a post that had just
    // been created. It looked like the shortcut had done nothing, so the
    // natural response was to press it again — which the server rejected as a
    // duplicate ("You just posted this"), making it look broken twice over.
    // Clicking the button never showed this because clicking moves focus to the
    // button first.
    //
    // Safe as an exception because there is nothing to clobber: the text being
    // removed is text the app has already decided to remove.
    const isReset = content.trim().length === 0;
    if (!isReset && document.activeElement === editor) {
      return;
    }

    const currentHtml = editor.innerHTML.replace(/\s+/g, ' ').trim();
    const expectedHtml = markdownToHtml(content).replace(/\s+/g, ' ').trim();

    // `expectedHtml !== '<br>'` stops an empty render from wiping the editor
    // mid-keystroke, but it would also block a deliberate reset, so a reset is
    // allowed past it for the same reason as above.
    if (currentHtml !== expectedHtml && (isReset || expectedHtml !== '<br>')) {
      const selection = getSelectionRange(editor);
      // On a reset there is no position left to restore — the old offsets point
      // into text that no longer exists — so the caret simply goes to the start
      // of the now-empty composer, which is where someone would begin typing.
      const wasFocused = !isReset && document.activeElement === editor;

      editor.innerHTML = sanitize(expectedHtml || '<br>');

      if (selection && wasFocused) {
        requestAnimationFrame(() => {
          if (editor) {
            try {
              setSelectionRange(editor, selection.start, selection.end);
              editor.focus();
            } catch {
              editor.focus();
            }
          }
        });
      }
    }
  }, [content, isComposing, sanitize]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    setIsComposing(true);

    setTimeout(() => {
      if (editor) {
        const html = sanitize(editor.innerHTML);
        const markdown = htmlToMarkdown(html);

        if (markdown !== content) {
          onContentChange(markdown);
        }

        editor.style.height = 'auto';
        editor.style.height = `${Math.min(editor.scrollHeight, maxHeight)}px`;
        editor.style.overflowY = editor.scrollHeight > maxHeight ? 'auto' : 'hidden';
      }
      setIsComposing(false);
    }, 10);
  }, [content, maxHeight, onContentChange, sanitize]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      // A pasted screenshot/photo becomes an attachment, not stripped text.
      const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0 && onPasteFiles) {
        e.preventDefault();
        onPasteFiles(imageFiles);
        return;
      }

      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);

      const html = sanitize(editor.innerHTML);
      const markdown = htmlToMarkdown(html);
      onContentChange(markdown);
    },
    [onContentChange, sanitize, onPasteFiles]
  );

  const handleFormat = useCallback(
    (format: 'bold' | 'italic') => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.focus();
      document.execCommand(format === 'bold' ? 'bold' : 'italic', false);

      setTimeout(() => {
        if (editor) {
          const html = sanitize(editor.innerHTML);
          const markdown = htmlToMarkdown(html);
          onContentChange(markdown);
        }
      }, 0);
    },
    [onContentChange, sanitize]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!disabled && onSubmit) {
          onSubmit();
        }
      }

      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        handleFormat('bold');
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        handleFormat('italic');
      }
    },
    [disabled, onSubmit, onCancel, handleFormat]
  );

  return {
    editorRef,
    handleInput,
    handlePaste,
    handleKeyDown,
    handleFormat,
    isComposing,
  };
}

export default useContentEditableEditor;
