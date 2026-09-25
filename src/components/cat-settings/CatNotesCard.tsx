'use client';

/**
 * The notes Cat reads on every message (context documents), as one compact
 * list. Replaces the old Context tab's per-type boxes and its "completeness"
 * percentage — a score for filling in forms is a game, not help.
 */

import Link from 'next/link';
import { ChevronRight, FileText, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEntityList } from '@/hooks/useEntityList';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import {
  documentEntityConfig,
  DOCUMENT_TYPE_LABELS,
  type DocumentListItem,
} from '@/config/entities/documents';

export function CatNotesCard() {
  const { user } = useAuth();
  const { items, loading } = useEntityList<DocumentListItem>({
    apiEndpoint: documentEntityConfig.apiEndpoint,
    userId: user?.id,
    limit: 50,
    enabled: !!user?.id,
  });

  return (
    <section className="overflow-hidden rounded-lg border border-default bg-surface-base">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg-primary">Notes Cat reads</h3>
          <p className="mt-0.5 text-sm text-fg-secondary">
            Goals, skills, finances, plans — private, and read on every message.
          </p>
        </div>
        <Link
          href={ROUTES.DASHBOARD.DOCUMENTS_CREATE}
          className="inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-md border border-subtle px-3 text-sm text-fg-primary transition-colors hover:bg-surface-raised"
        >
          <Plus className="h-4 w-4" />
          Add a note
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center border-t border-subtle py-6">
          <Loader2 className="h-5 w-5 animate-spin text-fg-tertiary" />
        </div>
      ) : items.length > 0 ? (
        <ul className="divide-y divide-border-subtle border-t border-subtle">
          {items.map(doc => (
            <li key={doc.id}>
              <Link
                href={`${ENTITY_REGISTRY['document'].basePath}/${doc.id}`}
                className="flex min-h-12 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-raised"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-fg-tertiary" />
                <span className="min-w-0 flex-1 truncate text-sm text-fg-primary">{doc.title}</span>
                <span className="flex-shrink-0 text-xs text-fg-tertiary">
                  {(DOCUMENT_TYPE_LABELS as Record<string, string>)[doc.document_type || 'notes'] ??
                    doc.document_type}
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-fg-tertiary" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
