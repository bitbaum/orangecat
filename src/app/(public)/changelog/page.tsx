import { PageHeading } from '@/components/layout/PageHeading';
import { FormattedDate } from '@/components/ui/FormattedDate';
import { changelogLines, loadOrangeCatProfile, sortChangelog } from '@/lib/development/records';

export const metadata = {
  title: 'Changelog',
  description:
    'What’s new on OrangeCat — every update that shipped, newest first. Bitcoin-native funding, discovery, and the sovereign personal economy, in the open.',
};

/**
 * /changelog — public product changelog (no login required), rendered from
 * the fleet map. The record is CHANGELOG.md at the repository root; Loki's
 * map ingests it. A quiet timeline: date on the rail, what shipped beside it.
 */
export default async function ChangelogPage() {
  const profile = await loadOrangeCatProfile();
  const entries = profile ? sortChangelog(profile.changelog) : [];

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
            Newest first.
          </p>
        </div>

        {profile === null ? (
          <p className="rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            The changelog is temporarily unavailable. It is read from the fleet map, which did not
            answer just now; try again in a few minutes.
          </p>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            Nothing recorded yet.
          </p>
        ) : (
          <ol className="relative space-y-12 border-l border-default pl-6 sm:pl-8">
            {entries.map((entry, i) => {
              const lines = changelogLines(entry);
              return (
                <li key={`${entry.date}-${i}`} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[calc(0.25rem+1px)] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-accent-warm ring-4 ring-surface-page sm:-left-[calc(0.5rem+1px)]"
                  />
                  <time dateTime={entry.date} className="font-mono text-xs text-fg-tertiary">
                    <FormattedDate value={entry.date} mode="isoDay" />
                  </time>
                  {lines.length === 1 ? (
                    <p className="mt-2 text-fg-secondary">{lines[0]}</p>
                  ) : (
                    <ul className="mt-2 space-y-2.5">
                      {lines.map((line, j) => (
                        <li key={j} className="flex gap-2.5 text-fg-secondary">
                          <span
                            aria-hidden
                            className="mt-2.5 h-1 w-1 flex-shrink-0 rounded-full bg-strong"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-16 border-t border-default pt-8 text-sm text-fg-tertiary">
          Everything here shipped to production; the record is{' '}
          <a
            href="https://github.com/bitbaum/orangecat/blob/main/CHANGELOG.md"
            className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            CHANGELOG.md
          </a>{' '}
          in the repository. Follow along —{' '}
          <a
            href="/discover"
            className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            explore what people are building
          </a>
          .
        </p>
      </div>
    </div>
  );
}
