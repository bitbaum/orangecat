'use client';

/**
 * What a companion remembers about you — the one trust surface.
 * Every line can be forgotten; everything can be forgotten; the creator
 * cannot see any of it, and the page says so.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';

interface Memory {
  id: string;
  content: string;
  created_at: string;
}

interface MemoryListProps {
  companionId: string;
  name: string;
}

export function MemoryList({ companionId, name }: MemoryListProps) {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = COMPANION_COPY.memory;

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.MEMORIES(companionId));
      const json = (await res.json()) as { data?: { memories: Memory[] } };
      setMemories(json.data?.memories ?? []);
    } catch (err) {
      logger.error('Companion memories failed to load', err, 'MemoryList');
      setMemories([]);
    }
  }, [companionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [added, setAdded] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Add a memory (no id) or correct one (its id): the server answers the new list. */
  const write = async (content: string, id?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.MEMORIES(companionId), {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id, content } : { content }),
      });
      const json = (await res.json()) as { data?: { memories: Memory[] } };
      if (!res.ok || !json.data) {
        throw new Error(copy.failed);
      }
      setMemories(json.data.memories);
      setEditing(null);
      setAdded('');
    } catch (err) {
      logger.error('Companion memory failed to save', err, 'MemoryList');
      setError(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  const forget = async (query: string) => {
    setBusy(true);
    try {
      await fetch(`${API_ROUTES.AI_ASSISTANTS.MEMORIES(companionId)}?${query}`, {
        method: 'DELETE',
      });
      await load();
    } finally {
      setBusy(false);
      setConfirmAll(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-lg font-semibold text-fg-primary">{copy.title(name)}</h1>
      <p className="mt-1 text-sm text-fg-tertiary">{COMPANION_COPY.memoryPrivacy(name)}</p>

      <form
        className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={e => {
          e.preventDefault();
          void write(added.trim());
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-fg-secondary">
          <span>{copy.addLabel(name)}</span>
          <input
            type="text"
            value={added}
            onChange={e => setAdded(e.target.value)}
            maxLength={240}
            placeholder={copy.addPlaceholder}
            className="min-h-[44px] w-full rounded-xl border border-subtle bg-surface-raised px-3 text-fg-primary"
          />
        </label>
        <Button type="submit" size="sm" disabled={busy || added.trim().length < 3}>
          {copy.add}
        </Button>
      </form>
      {error && <p className="mb-0 mt-2 text-sm text-status-negative">{error}</p>}

      {memories === null ? null : memories.length === 0 ? (
        <p className="mt-8 text-sm text-fg-secondary">{copy.empty(name)}</p>
      ) : (
        <ul className="mt-6 divide-y divide-subtle">
          {memories.map(m => (
            <li key={m.id} className="flex items-start justify-between gap-4 py-3">
              {editing === m.id ? (
                <form
                  className="flex w-full flex-col gap-2"
                  onSubmit={e => {
                    e.preventDefault();
                    void write(draft.trim(), m.id);
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    maxLength={240}
                    rows={2}
                    aria-label={copy.edit}
                    className="w-full rounded-xl border border-subtle bg-surface-raised p-3 text-base text-fg-primary"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={busy || draft.trim().length < 3}>
                      {copy.save}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(null)}
                    >
                      {copy.cancel}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <span className="text-sm leading-relaxed text-fg-primary">{m.content}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="min-h-[44px] px-2 text-sm text-fg-secondary hover:text-fg-primary"
                      disabled={busy}
                      onClick={() => {
                        setDraft(m.content);
                        setEditing(m.id);
                      }}
                    >
                      {copy.edit}
                    </button>
                    <button
                      type="button"
                      className="min-h-[44px] px-2 text-sm text-fg-secondary hover:text-status-negative"
                      disabled={busy}
                      onClick={() => void forget(`id=${m.id}`)}
                    >
                      {copy.forgetOne}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {memories && memories.length > 0 && (
        <div className="mt-8 flex items-center gap-3">
          {confirmAll ? (
            <>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => void forget('all=true')}
              >
                {copy.forgetAllConfirm}
              </Button>
              <button
                type="button"
                className="text-sm text-fg-tertiary"
                onClick={() => setConfirmAll(false)}
              >
                Keep them
              </button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmAll(true)}>
                {copy.forgetAll}
              </Button>
              <span className="text-xs text-fg-tertiary">{copy.forgetAllHint}</span>
            </>
          )}
        </div>
      )}
    </section>
  );
}
