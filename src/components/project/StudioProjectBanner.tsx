'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PillarMark } from '@/components/ecosystem/PillarMark';
import { LAYER_LABELS, type FleetTile } from '@/components/ecosystem/studio-fleet';
import { ECOSYSTEM, ECOSYSTEM_PILLARS } from '@/config/ecosystem';
import { ROUTES } from '@/config/routes';
import { formatRelativeTime } from '@/utils/dates';

/**
 * "This is one of the studio's own products." Shown above the header of a
 * project page that the fleet map knows: the product's face, its live door,
 * when it last moved, and the two sibling pillars beside it — so Loki's page
 * on OrangeCat looks like Loki, and leads to Solon and back here.
 */
export default function StudioProjectBanner({ studio }: { studio: FleetTile }) {
  const siblings = ECOSYSTEM_PILLARS.filter(p => p.key !== studio.pillar);
  const door = studio.external ? studio.href : null;

  return (
    <aside className="oc-surface mb-6 p-4 sm:p-5" aria-label={`${studio.name} in the studio`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="oc-studio-pillar-mark mb-0 h-14 w-14 shrink-0" aria-hidden="true">
          {studio.pillar ? (
            <PillarMark pillar={studio.pillar} size={38} animated />
          ) : (
            <span className="oc-studio-monogram text-2xl">
              {studio.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="ui-kicker">
            {ECOSYSTEM.studio.title} · {LAYER_LABELS[studio.layer] ?? studio.layer}
          </p>
          <p className="mt-1 text-sm text-fg-secondary">
            <span className="font-medium text-fg-primary">{studio.name}</span>
            {studio.live ? ' is live' : ` is ${studio.status}`}
            {studio.lastMovedOn
              ? `, last moved ${formatRelativeTime(studio.lastMovedOn)}`
              : ''}. Built in the open on this stack, funded here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {door && (
            <a
              href={door}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-strong px-3 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
            >
              Open {studio.name} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
          <ul className="flex items-center gap-1.5" aria-label="Sibling products">
            {siblings.map(pillar => (
              <li key={pillar.key}>
                <Link
                  href={pillar.isSelf ? ROUTES.ECOSYSTEM : pillar.siteUrl}
                  className="oc-icon-tile oc-card-link"
                  title={`${pillar.title} — ${pillar.role}`}
                  aria-label={`${pillar.title} — ${pillar.role}`}
                  {...(pillar.isSelf ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                >
                  <PillarMark pillar={pillar.key} size={22} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
