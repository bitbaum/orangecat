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

      {memories === null ? null : memories.length === 0 ? (
        <p className="mt-8 text-sm text-fg-secondary">{copy.empty(name)}</p>
      ) : (
        <ul className="mt-6 divide-y divide-subtle">
          {memories.map(m => (
            <li key={m.id} className="flex items-start justify-between gap-4 py-3">
              <span className="text-sm leading-relaxed text-fg-primary">{m.content}</span>
              <button
                type="button"
                className="shrink-0 text-xs text-fg-tertiary hover:text-status-negative"
                disabled={busy}
                onClick={() => void forget(`id=${m.id}`)}
              >
                {copy.forgetOne}
              </button>
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
