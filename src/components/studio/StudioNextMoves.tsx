'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { STUDIO_NEXT_MOVES } from '@/config/studio';
import { getEntityMetadata } from '@/config/entity-registry';
import type { EntityType } from '@/config/entity-registry';

/**
 * What a finished piece is FOR. The Studio is not a toy: every medium ends at
 * an entity that can take money, which is the only thing that makes "create"
 * the same verb as "earn" here.
 *
 * Paths come from the entity registry, never typed — the create page for
 * products has moved once already.
 */
export default function StudioNextMoves() {
  return (
    <section aria-labelledby="studio-next" className="oc-surface p-5 sm:p-6">
      <h3 id="studio-next" className="text-sm font-semibold text-fg-primary">
        Now put it to work
      </h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {STUDIO_NEXT_MOVES.map(move => {
          const meta = getEntityMetadata(move.entityType as EntityType);
          const Icon = meta.icon;
          return (
            <li key={move.id}>
              <Link
                href={meta.createPath}
                className="oc-card-link flex h-full flex-col rounded-lg border border-default p-4"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-fg-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                  {move.title}
                </span>
                <span className="mt-2 flex-1 text-sm text-fg-secondary">{move.body}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-fg-primary">
                  {meta.createActionLabel}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
