'use client';

/**
 * A bot's library: the photos, files and links from your chats with it,
 * newest first. Read from your own stored messages; nothing else is kept.
 */

import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Link2 } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import type { LibraryItem } from '@/services/companions/library';
import { formatDate } from '@/utils/dates';
import { logger } from '@/utils/logger';

interface LibraryListProps {
  companionId: string;
  name: string;
}

export function LibraryList({ companionId, name }: LibraryListProps) {
  const copy = COMPANION_COPY.library;
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(API_ROUTES.AI_ASSISTANTS.LIBRARY(companionId));
        const json = (await res.json()) as { data?: { items: LibraryItem[] } };
        if (!res.ok || !json.data) {
          throw new Error('library');
        }
        if (live) {
          setItems(json.data.items);
        }
      } catch (err) {
        logger.error('Library failed to load', err, 'LibraryList');
        if (live) {
          setFailed(true);
          setItems([]);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [companionId]);

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-lg font-semibold text-fg-primary">{copy.title(name)}</h1>
      <p className="mb-0 mt-1 text-sm text-fg-tertiary">{copy.privacy}</p>

      {failed && <p className="mb-0 mt-8 text-sm text-status-negative">{copy.failed}</p>}
      {items !== null && !failed && items.length === 0 && (
        <p className="mb-0 mt-8 text-sm text-fg-secondary">{copy.empty(name)}</p>
      )}
      {items !== null && items.length > 0 && (
        <ul className="mt-6 divide-y divide-subtle">
          {items.map((item, i) => {
            const Icon = item.kind === 'link' ? Link2 : item.kind === 'file' ? FileText : ImageIcon;
            const body = (
              <>
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-fg-tertiary" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="block truncate text-base text-fg-primary">{item.name}</span>
                  <span className="block text-sm text-fg-secondary">
                    {copy.kinds[item.kind]} · {item.from === 'you' ? copy.fromYou : name} ·{' '}
                    {formatDate(item.at)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={`${item.at}-${i}`}>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] items-start gap-3 py-3"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex min-h-[44px] items-start gap-3 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
