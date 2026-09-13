'use client';

import { Landmark, ArrowUpRight } from 'lucide-react';
import { ECOSYSTEM } from '@/config/ecosystem';
import type { EntityType } from '@/config/entity-registry';

/**
 * Solon cross-sell — "govern the strings" for investment entities.
 *
 * Mirrors LokiBuildCta as the economy→governance bridge. v1 is a deep
 * link into Solon with entity context in the query string. Solon already
 * governs platform allocation via verified decisions; entity-scoped proposal
 * ingest can grow behind this same CTA without changing the owner-facing seam.
 *
 * No signed handoff until Solon has a receive path — a working discoverability
 * bridge beats a half-broken protocol. Do not delete LokiBuildCta.
 */

interface SolonGovernCtaProps {
  variant: 'banner' | 'card';
  entityType: EntityType;
  entityId: string;
  sourcePath: string;
  title?: string;
}

function solonGovernUrl(props: {
  entityType: EntityType;
  entityId: string;
  sourcePath: string;
  title?: string;
}): string {
  const url = new URL('/dashboard', ECOSYSTEM.solon.siteUrl);
  url.searchParams.set('from', 'orangecat');
  url.searchParams.set('entity_type', props.entityType);
  url.searchParams.set('entity_id', props.entityId);
  url.searchParams.set('source', props.sourcePath);
  if (props.title) url.searchParams.set('title', props.title.slice(0, 120));
  return url.toString();
}

const COPY = {
  title: `Govern it with ${ECOSYSTEM.solon.title}`,
  body: 'Investment strings become decisions: Bitcoin-signed votes, verifiable policies, no custody.',
  action: `Open ${ECOSYSTEM.solon.title}`,
} as const;

export default function SolonGovernCta({
  variant,
  entityType,
  entityId,
  sourcePath,
  title,
}: SolonGovernCtaProps) {
  const href = solonGovernUrl({ entityType, entityId, sourcePath, title });

  if (variant === 'banner') {
    return (
      <div className="mb-4 rounded-md border border-subtle bg-surface-raised/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md border border-subtle bg-surface-page p-2">
              <Landmark className="h-5 w-5 text-accent-warm" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-medium text-fg-primary">{COPY.title}</h3>
              <p className="mt-1 text-sm text-fg-secondary">{COPY.body}</p>
            </div>
          </div>
          <a
            href={href}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-subtle px-3 py-1.5 text-sm font-medium text-fg-primary hover:bg-surface-raised"
          >
            {COPY.action}
            <ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-subtle bg-surface-base p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-subtle bg-surface-page p-2">
          <Landmark className="h-5 w-5 text-accent-warm" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-fg-primary">{COPY.title}</h3>
          <p className="mt-1 text-sm text-fg-secondary">{COPY.body}</p>
        </div>
      </div>
      <a
        href={href}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-subtle px-3 py-2 text-sm font-medium text-fg-primary hover:bg-surface-raised"
      >
        {COPY.action}
        <ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}
