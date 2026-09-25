'use client';

/**
 * CatMemoryManager — view and control what Cat remembers about you.
 *
 * Lists the durable facts Cat has learned (from chat), with per-item delete and
 * a guarded "Forget everything". Privacy-first: memory is only useful if the
 * user can see and erase it, ChatGPT-style. Talks to /api/cat/memories.
 */

import { Switch } from '@/components/ui/switch';
import { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Trash2,
  Loader2,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { formatMemoriesForExport, MEMORY_EXPORT_FILENAME } from '@/config/cat-memory-import';

interface Memory {
  id: string;
  content: string;
  created_at: string;
}

/** How many memories show before "Show all" — enough to prove the feature, few enough to scan. */
const MEMORY_PREVIEW_COUNT = 3;

interface CatMemoryManagerProps {
  /** Bump to force a reload — e.g. after an import adds new memories. */
  reloadKey?: number;
  /** Consent state: is Cat allowed to store new memories? Omit to hide the toggle. */
  memoryEnabled?: boolean;
  /** Called with the new consent value when the user flips the toggle. */
  onToggleMemory?: (enabled: boolean) => Promise<void> | void;
}

export function CatMemoryManager({
  reloadKey = 0,
  memoryEnabled,
  onToggleMemory,
}: CatMemoryManagerProps = {}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.CAT.MEMORIES);
      if (!res.ok) {
        throw new Error('Failed to load memories');
      }
      const json = await res.json();
      setMemories((json?.data?.memories ?? []) as Memory[]);
    } catch (err) {
      logger.error('Failed to load cat memories', err, 'CatMemory');
      setError('Could not load memories. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_ROUTES.CAT.MEMORIES}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('delete failed');
      }
      setMemories(prev => prev.filter(m => m.id !== id));
      toast.success('Memory forgotten');
    } catch (err) {
      logger.error('Failed to delete memory', err, 'CatMemory');
      toast.error('Could not delete that memory');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleExport = useCallback(() => {
    const text = formatMemoriesForExport(memories.map(m => m.content));
    // Portable, re-importable: download the exact plain-line shape the importer
    // accepts, so the user can take their memory anywhere. Their right of exit.
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = MEMORY_EXPORT_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`);
  }, [memories]);

  const handleClearAll = useCallback(async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`${API_ROUTES.CAT.MEMORIES}?all=true`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('clear failed');
      }
      setMemories([]);
      setConfirmClear(false);
      toast.success('Cleared everything Cat remembered');
    } catch (err) {
      logger.error('Failed to clear memories', err, 'CatMemory');
      toast.error('Could not clear memories');
    } finally {
      setIsClearing(false);
    }
  }, []);

  return (
    <section className="rounded-lg border border-default bg-surface-base p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-md bg-surface-raised p-2">
          <Brain className="h-5 w-5 text-fg-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-fg-primary">What Cat remembers</h2>
            {memories.length > 0 && !confirmClear && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg-primary"
                >
                  <Download className="h-4 w-4" /> Export
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-sm text-fg-secondary underline hover:text-status-negative"
                >
                  Forget everything
                </button>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-fg-secondary">
            Durable facts Cat has learned about you from your conversations, so it carries context
            across sessions. You control all of it — delete anything, anytime.
          </p>
          {memoryEnabled !== undefined && onToggleMemory && (
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              {/* The shared Switch. The hand-built one positioned its knob
                  with no `left`, so at phone width it drifted out of the track
                  and over this label. */}
              <Switch
                checked={memoryEnabled}
                onCheckedChange={checked => void onToggleMemory(checked)}
                aria-label="Remember details from our conversations"
                className="mt-0.5 flex-shrink-0"
              />
              <span className="text-sm text-fg-primary">
                Remember details from our conversations
                <span className="block text-xs text-fg-tertiary">
                  Off = Cat stops saving new memories. Existing ones stay until you delete them.
                </span>
              </span>
            </label>
          )}
        </div>
      </div>

      {confirmClear && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-negative/30 bg-status-negative-subtle p-3">
          <span className="text-sm text-fg-primary">
            Forget everything Cat remembers? This can&apos;t be undone.
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmClear(false)}
              disabled={isClearing}
              className="h-11 px-3 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleClearAll}
              disabled={isClearing}
              className="h-11 gap-2 bg-status-negative px-3 text-sm text-fg-inverted hover:bg-status-negative/90"
            >
              {isClearing && <Loader2 className="h-4 w-4 animate-spin" />}
              Forget everything
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-fg-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading memories…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-subtle bg-surface-raised/30 p-4">
          <span className="flex items-center gap-2 text-sm text-status-negative">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
          <Button variant="outline" onClick={load} className="h-11 px-3 text-sm">
            Retry
          </Button>
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-md border border-subtle bg-surface-raised/30 p-6 text-center">
          <p className="text-sm text-fg-secondary">
            Cat hasn&apos;t saved any memories yet. As you chat and share preferences, goals, or
            details about your projects, it&apos;ll remember the durable ones here.
          </p>
        </div>
      ) : (
        <>
          {/* Preview a few, disclose the rest — a long memory list must not
              dominate the settings page (it once dumped 20+ items inline). */}
          <ul className="space-y-2">
            {(showAll ? memories : memories.slice(0, MEMORY_PREVIEW_COUNT)).map(m => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-md border border-subtle bg-surface-raised/30 p-3"
              >
                <span className="text-sm text-fg-primary">{m.content}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  aria-label="Forget this memory"
                  className="shrink-0 rounded-md p-1 text-fg-tertiary hover:bg-surface-raised hover:text-status-negative disabled:opacity-40"
                >
                  {deletingId === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {memories.length > MEMORY_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              aria-expanded={showAll}
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-fg-secondary hover:text-fg-primary"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Show fewer
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Show all {memories.length} memories
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default CatMemoryManager;
