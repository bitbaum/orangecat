'use client';

/**
 * CatMemoryImport — bring your memory from another AI into Cat.
 *
 * Two steps: copy a prompt into your other assistant (ChatGPT, Grok, Gemini…),
 * then paste what it exports back here. OrangeCat distils it into durable Cat
 * memories, deduped against what Cat already knows. Portable, user-owned context
 * — the "right of exit" made real. Talks to /api/cat/memories/import.
 */

import { useCallback, useState } from 'react';
import { ArrowDownToLine, Copy, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { MEMORY_IMPORT_PROMPT } from '@/config/cat-memory-import';

interface CatMemoryImportProps {
  /** Called after a successful import so a sibling memory list can refresh. */
  onImported?: () => void;
}

export function CatMemoryImport({ onImported }: CatMemoryImportProps) {
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  // Collapsed by default: importing is a one-time task, so the two-step wizard
  // should not occupy the page for everyone who never needs it.
  const [open, setOpen] = useState(false);

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(MEMORY_IMPORT_PROMPT);
      setCopied(true);
      toast.success('Prompt copied — paste it into your other AI');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowPrompt(true);
      toast.error('Could not copy automatically — select the prompt below and copy it');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Paste your exported memory first');
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch(API_ROUTES.CAT.MEMORIES_IMPORT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(apiErrorMessage(json, 'Import failed'));
      }
      const {
        total = 0,
        imported = 0,
        skipped = 0,
        embeddingsEnabled = true,
      } = (json.data ?? {}) as {
        total?: number;
        imported?: number;
        skipped?: number;
        embeddingsEnabled?: boolean;
      };

      if (total === 0) {
        toast.error("Couldn't find any memories in that text. Paste the whole export.");
      } else if (imported === 0) {
        toast.success(`Nothing new — Cat already remembered all ${total}.`);
      } else {
        toast.success(
          `Imported ${imported} ${imported === 1 ? 'memory' : 'memories'}` +
            (skipped > 0 ? `, skipped ${skipped} already known.` : '.')
        );
        setText('');
        onImported?.();
        if (!embeddingsEnabled) {
          toast.message('Stored — but semantic recall is off until an embeddings provider is set.');
        }
      }
    } catch (err) {
      logger.error('Failed to import memories', err, 'CatMemory');
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [text, onImported]);

  return (
    <section className="rounded-lg border border-default bg-surface-base p-6">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="rounded-md bg-surface-raised p-2">
          <ArrowDownToLine className="h-5 w-5 text-fg-primary" />
        </div>
        <div className="flex-1">
          <span className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-fg-primary">Import from another AI</h2>
            {open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-fg-secondary" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-fg-secondary" />
            )}
          </span>
          <p className="mt-1 text-sm text-fg-secondary">
            Already have context in ChatGPT, Grok, Gemini or Claude? Bring it over so Cat starts
            warm instead of cold.
          </p>
        </div>
      </button>

      {!open ? null : (
        <div className="mt-4">
          <p className="mb-4 text-sm text-fg-secondary">
            Copy the prompt, run it in your other assistant, and paste the result back — Cat keeps
            what&apos;s new and skips anything it already knows.
          </p>

          {/* Step 1 — copy the prompt */}
          <div className="mb-4 rounded-md border border-subtle bg-surface-raised/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg-primary">
                1 · Copy this prompt into your other AI
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrompt(v => !v)}
                  className="inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg-primary"
                >
                  {showPrompt ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {showPrompt ? 'Hide' : 'Show'} prompt
                </button>
                <Button
                  variant="outline"
                  onClick={copyPrompt}
                  className="h-11 gap-2 px-3 text-sm"
                  aria-label="Copy the import prompt"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy prompt'}
                </Button>
              </div>
            </div>
            {showPrompt && (
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-subtle bg-surface-page p-3 text-xs text-fg-secondary">
                {MEMORY_IMPORT_PROMPT}
              </pre>
            )}
          </div>

          {/* Step 2 — paste the result */}
          <div className="rounded-md border border-subtle bg-surface-raised/30 p-3">
            <label htmlFor="memory-import" className="text-sm font-medium text-fg-primary">
              2 · Paste the result here
            </label>
            <textarea
              id="memory-import"
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={isImporting}
              rows={6}
              placeholder="Paste everything your other AI exported…"
              className="mt-2 w-full resize-y rounded-md border border-subtle bg-surface-page p-3 text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent-warm disabled:opacity-60"
            />
            <div className="mt-3 flex items-center justify-end">
              <Button
                variant="accent"
                onClick={handleImport}
                disabled={isImporting || !text.trim()}
                className="h-11 gap-2 px-4 text-sm"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                Import into Cat
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CatMemoryImport;
