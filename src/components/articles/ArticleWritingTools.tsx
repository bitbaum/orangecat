'use client';

import { useState, type RefObject } from 'react';
import Button from '@/components/ui/Button';
import AiWriterPanel from './AiWriterPanel';
import ArticleAiControls from './ArticleAiControls';
import { useArticleAi } from './useArticleAi';

type Props = Parameters<typeof useArticleAi>[0] & {
  disabled: boolean;
  bodyRef: RefObject<HTMLTextAreaElement | null>;
  onInsertImage: () => void;
};

/** Mounted once per draft: one entry point, request state and safe Undo. */
export default function ArticleWritingTools({
  disabled,
  bodyRef,
  onInsertImage,
  ...params
}: Props) {
  const [open, setOpen] = useState(false);
  const ai = useArticleAi({
    ...params,
    onApplied: () => {
      setOpen(false);
      params.onApplied?.();
      requestAnimationFrame(() => {
        bodyRef.current?.focus({ preventScroll: true });
        bodyRef.current?.scrollIntoView?.({ block: 'nearest' });
      });
    },
  });
  return (
    <div className="space-y-2">
      <details
        open={open}
        onToggle={e => setOpen(e.currentTarget.open)}
        className="rounded-md border border-default px-3"
      >
        <summary
          onClick={() => ai.captureSelection()}
          className="min-h-11 cursor-pointer py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ask Cat
        </summary>
        <div className="space-y-3 pb-3">
          {params.body.trim() ? (
            <ArticleAiControls ai={ai} disabled={disabled} onInsertImage={onInsertImage} />
          ) : (
            <AiWriterPanel title={params.title} ai={ai} disabled={disabled} />
          )}
        </div>
      </details>
      {ai.busy && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 text-sm text-fg-secondary"
        >
          <span>Cat is working on this draft…</span>
          <Button type="button" variant="ghost" onClick={ai.cancel}>
            Cancel
          </Button>
        </div>
      )}
      {ai.error && (
        <p role="alert" className="text-sm text-status-negative">
          {ai.error}
        </p>
      )}
      {ai.canUndo && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 text-sm text-fg-secondary"
        >
          <span>Cat updated this draft.</span>
          <Button type="button" variant="ghost" onClick={ai.undoChange}>
            Undo
          </Button>
        </div>
      )}
    </div>
  );
}
