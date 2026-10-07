'use client';

import { Landmark, ArrowUpRight } from 'lucide-react';
import { ECOSYSTEM } from '@/config/ecosystem';
import { solonProposalHandoff } from '@/config/neighbour-capabilities';
import type { EntityType } from '@/config/entity-registry';

/**
 * Solon cross-sell — "govern the strings" for investment entities.
 *
 * Mirrors LokiBuildCta as the economy→governance bridge: a deep link into
 * Solon's proposal form with the entity in the query, which Solon reads into a
 * pre-filled draft (bitbaum/solon `lib/domain/proposal-draft`). The draft
 * survives Solon's sign-in and join round-trips, so the owner lands on a form
 * that already names their entity — never on a page that forgot it.
 *
 * This used to target /dashboard, which read none of the parameters: the
 * button promised to govern a specific thing and delivered a generic page.
 *
 * No signed handoff yet — a working pre-fill beats a half-broken protocol.
 * Do not delete LokiBuildCta.
 */

interface SolonGovernCtaProps {
  variant: 'banner' | 'card';
  entityType: EntityType;
  entityId: string;
  sourcePath: string;
  title?: string;
  /** A pre-filled proposal body and Solon category (e.g. a research milestone). */
  draft?: { title?: string; body: string; category: string };
}

function solonGovernUrl(props: Omit<SolonGovernCtaProps, 'variant'>): string {
  return solonProposalHandoff({
    entityType: props.entityType,
    entityId: props.entityId,
    source: props.sourcePath,
    title: props.draft?.title ?? props.title,
    body: props.draft?.body,
    category: props.draft?.category,
  });
}

const DEFAULT_COPY = {
  title: `Govern it with ${ECOSYSTEM.solon.title}`,
  body: 'Investment strings become decisions: Bitcoin-signed votes, verifiable policies, no custody.',
  action: `Open ${ECOSYSTEM.solon.title}`,
};

/** Per-type wording; a type not listed says what an investment says. */
const COPY_BY_TYPE: Partial<Record<EntityType, typeof DEFAULT_COPY>> = {
  research: {
    title: `Let backers decide with ${ECOSYSTEM.solon.title}`,
    body: 'Put a milestone to a signed vote before the next tranche goes out. The proposal arrives citing your pre-registration and outputs. No custody.',
    action: 'Propose a milestone vote',
  },
};

export default function SolonGovernCta({
  variant,
  entityType,
  entityId,
  sourcePath,
  title,
  draft,
}: SolonGovernCtaProps) {
  const href = solonGovernUrl({ entityType, entityId, sourcePath, title, draft });
  const COPY = COPY_BY_TYPE[entityType] ?? DEFAULT_COPY;

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
