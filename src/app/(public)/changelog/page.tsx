import { linkDevelopment, type Advance } from 'bip-kit';
import { PageHeading } from '@/components/layout/PageHeading';
import { FormattedDate } from '@/components/ui/FormattedDate';
import { ROUTES } from '@/config/routes';
import { loadOrangeCatProfile } from '@/lib/development/records';

export const metadata = {
  title: 'Changelog',
  description:
    'What’s new on OrangeCat — every update that shipped, newest first. Bitcoin-native funding, discovery, and the sovereign personal economy, in the open.',
};

const LINK = 'text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline';

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
 * /changelog — public product changelog (no login required), rendered from
 * the fleet map. The record is CHANGELOG.md at the repository root; Loki's
 * map ingests it. A quiet timeline: date on the rail, what shipped beside it,
 * and — where a line carries a `{#id}` — the roadmap milestone it delivered
 * (bip-kit linkDevelopment; /roadmap links back).
 */
export default async function ChangelogPage() {
  const profile = await loadOrangeCatProfile();
  const changes = profile ? linkDevelopment(profile).changes : [];

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-14">
          <p className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
            Building in public
          </p>
          <PageHeading className="mb-3 mt-4">Changelog</PageHeading>
          <p className="max-w-2xl text-lg text-fg-secondary">
            What’s new on OrangeCat — building the Bitcoin-native personal economy in the open.
            Newest first. Where a change delivered something on the{' '}
            <a href={ROUTES.ROADMAP} className={LINK}>
              roadmap
            </a>
            , it says which.
          </p>
        </div>

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
          <ol className="relative space-y-12 border-l border-default pl-6 sm:pl-8">
            {changes.map(change => (
              <li key={change.anchor} id={change.anchor} className="relative scroll-mt-24">
                <span
                  aria-hidden
                  className="absolute -left-[calc(0.25rem+1px)] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-accent-warm ring-4 ring-surface-page sm:-left-[calc(0.5rem+1px)]"
                />
                <a href={`#${change.anchor}`} className="font-mono text-xs text-fg-tertiary">
                  <time dateTime={change.date}>
                    <FormattedDate value={change.date} mode="isoDay" />
                  </time>
                </a>
                <ul className="mt-2 space-y-2.5">
                  {change.lines.map((line, j) => (
                    <li key={j} className="flex gap-2.5 text-fg-secondary">
                      {change.lines.length > 1 && (
                        <span
                          aria-hidden
                          className="mt-2.5 h-1 w-1 flex-shrink-0 rounded-full bg-strong"
                        />
                      )}
                      <span className="min-w-0">
                        {line.text}
                        <Advances advances={line.advances} />
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
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
