import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProjectMark } from '@/components/brand/ProjectMark';
import { StudioFleetGrid } from '@/components/ecosystem/StudioFleetGrid';
import { selectHomeFleet } from '@/components/ecosystem/studio-fleet';
import { ECOSYSTEM, ECOSYSTEM_PILLARS } from '@/config/ecosystem';
import { ROUTES } from '@/config/routes';
import { fetchStudioMapForCat } from '@/services/ai/studio-map-fetcher';

/**
 * The studio behind the product, on the front page.
 *
 * Three marks, three products — the economy, the execution, the governance —
 * and under them every product the studio has live, each with its own face
 * and a link to its page. This is the proof the hero cannot give on its own:
 * not a pitch but a working economy with things in it, built in the open.
 * The list is Loki's fleet map, never a copy kept here; if the map cannot be
 * reached the pillars still stand and the grid is simply absent.
 */
export default async function StudioSection() {
  const map = await fetchStudioMapForCat();
  const tiles = selectHomeFleet(map);

  return (
    <section
      aria-labelledby="studio-heading"
      className="border-t border-default bg-surface-page py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="ui-kicker">{ECOSYSTEM.studio.title} · built in the open</p>
          <h2
            id="studio-heading"
            className="mt-3 font-heading text-3xl font-bold tracking-display text-fg-primary sm:text-4xl"
          >
            One stack. Every product on it.
          </h2>
        </header>

        <ul className="oc-studio-pillars" role="list">
          {ECOSYSTEM_PILLARS.map(pillar => (
            <li key={pillar.key}>
              <Link
                href={pillar.isSelf ? ROUTES.ECOSYSTEM : pillar.siteUrl}
                className="oc-studio-pillar oc-card-link"
                {...(pillar.isSelf ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
              >
                <span className="oc-studio-pillar-mark" aria-hidden="true">
                  <ProjectMark slug={pillar.key} name={pillar.title} size={44} animated />
                </span>
                <span className="font-heading text-xl font-semibold text-fg-primary">
                  {pillar.title}
                </span>
                <span className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
                  {pillar.role}
                </span>
                <span className="mt-1 text-sm text-fg-secondary">{pillar.tagline}</span>
              </Link>
            </li>
          ))}
        </ul>

        {tiles.length > 0 && (
          <div className="mt-10 sm:mt-14">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h3 className="text-sm font-medium uppercase tracking-caps text-fg-tertiary">
                Live now
              </h3>
              <Link
                href={ROUTES.ECOSYSTEM}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-fg-primary hover:underline"
              >
                The whole stack <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <StudioFleetGrid tiles={tiles} />
          </div>
        )}
      </div>
    </section>
  );
}
