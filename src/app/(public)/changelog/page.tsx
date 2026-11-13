import { linkDevelopment, type Advance, type LinkedChange } from '@bitbaum/bip-kit';
import { ChevronDown } from 'lucide-react';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { FormattedDate } from '@/components/ui/FormattedDate';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { groupChangelog, splitLead } from '@/lib/development/changelog-view';
import { loadOrangeCatProfile } from '@/lib/development/records';

export const metadata = {
  title: 'Changelog',
  description:
    'What’s new on OrangeCat — every update that shipped, newest first. Bitcoin-native funding, discovery, and the sovereign personal economy, in the open.',
};

const LINK = 'oc-text-link';

/** Under a line: the roadmap milestone it delivered, linked to its place on /roadmap. */
function Advances({ advances }: { advances: Advance[] }) {
  if (advances.length === 0) {
    return null;
  }
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-tertiary">
      {advances.map((a, i) => (
        <a key={i} href={`${ROUTES.ROADMAP}#${a.stepAnchor ?? a.goalAnchor}`} className={LINK}>
          → {a.goal}
          {a.step ? ` · ${a.step}` : ''}
        </a>
      ))}
    </span>
  );
}

/**
 * A run of days on the rail. Each line leads with its headline (the entry's
 * first sentence) and the rest beneath it; the dot sits on the rail itself.
 */
function ChangeDays({ days }: { days: LinkedChange[] }) {
  return (
    <ol className="relative space-y-12 border-l border-default pl-6 sm:pl-8">
      {days.map(change => (
        <li key={change.anchor} id={change.anchor} className="relative scroll-mt-24">
          <span
            aria-hidden
            className="absolute -left-6 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-fg-tertiary ring-4 ring-surface-page sm:-left-8"
          />
          <a href={`#${change.anchor}`} className="font-mono text-xs text-fg-secondary">
            <time dateTime={change.date}>
              <FormattedDate value={change.date} mode="isoDay" />
            </time>
          </a>
          <ul className="mt-2 space-y-5">
            {change.lines.map((line, j) => {
              const { lead, rest } = splitLead(line.text);
              return (
                <li key={j} className="min-w-0">
                  <h2 className="mb-0 text-base font-semibold text-fg-primary">{lead}</h2>
                  {rest && <p className="mb-0 mt-1 text-fg-secondary">{rest}</p>}
                  <Advances advances={line.advances} />
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/**
 * /changelog — public product changelog (no login required), rendered from
 * the fleet map. The record is CHANGELOG.md at the repository root; Loki's
 * map ingests it. A quiet timeline: date on the rail, what shipped beside it,
 * and — where a line carries a `{#id}` — the roadmap milestone it delivered
 * (bip-kit linkDevelopment; /roadmap links back).
 */
export default async function ChangelogPage() {
  const profile = await loadOrangeCatProfile();
  const changes = profile ? linkDevelopment(profile).changes : [];
  const { recent, months } = groupChangelog(changes);

  return (
    <div className="min-h-screen bg-surface-page">
      <div className={cn(PUBLIC_PAGE_WIDTH.reading, 'pb-16')}>
        <PublicPageHeader
          align="start"
          eyebrow="Building in public"
          title="Changelog"
          lede={
            <>
              What’s new on OrangeCat — building the Bitcoin-native personal economy in the open.
              Newest first. Where a change delivered something on the{' '}
              <a href={ROUTES.ROADMAP} className={LINK}>
                roadmap
              </a>
              , it says which.
            </>
          }
        />

        {profile === null ? (
          <p className="rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            The changelog is temporarily unavailable. It is read from the fleet map, which did not
            answer just now; try again in a few minutes.
          </p>
        ) : changes.length === 0 ? (
          <p className="rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            Nothing recorded yet.
          </p>
        ) : (
          <>
            <ChangeDays days={recent} />
            {months.map(month => (
              <details key={month.key} className="group mt-12 border-t border-default pt-6">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-fg-primary">
                  <span>
                    {month.label}
                    <span className="font-normal text-fg-secondary">
                      , {month.lineCount} {month.lineCount === 1 ? 'change' : 'changes'}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="h-4 w-4 flex-shrink-0 text-fg-secondary transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="mt-6">
                  <ChangeDays days={month.days} />
                </div>
              </details>
            ))}
          </>
        )}

        <p className="mt-16 border-t border-default pt-8 text-sm text-fg-tertiary">
          Everything here shipped to production; the record is{' '}
          <a href="https://github.com/bitbaum/orangecat/blob/main/CHANGELOG.md" className={LINK}>
            CHANGELOG.md
          </a>{' '}
          in the repository. Follow along —{' '}
          <a href="/discover" className={LINK}>
            explore what people are building
          </a>
          .
        </p>
      </div>
    </div>
  );
}
