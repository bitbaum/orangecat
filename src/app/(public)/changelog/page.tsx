import React from 'react';
import { PageHeading } from '@/components/layout/PageHeading';
import { CHANGELOG, CHANGELOG_TAGS, type ChangelogTag } from '@/config/changelog';
import { formatIsoDay } from '@/utils/dates';

export const metadata = {
  title: 'Changelog',
  description:
    'What’s new on OrangeCat — every update that shipped, newest first. Bitcoin-native funding, discovery, and the sovereign personal economy, in the open.',
};

// Warm accent for the notable tags (new features, platform), monochrome for the rest.
const TAG_CHIP: Record<ChangelogTag, string> = {
  feature: 'border-accent-warm text-accent-warm',
  platform: 'border-accent-warm text-accent-warm',
  improvement: 'border-default text-fg-secondary',
  fix: 'border-default text-fg-tertiary',
};
const TAG_DOT: Record<ChangelogTag, string> = {
  feature: 'bg-accent-warm',
  platform: 'bg-accent-warm',
  improvement: 'bg-strong',
  fix: 'bg-strong',
};

/**
 * /changelog — public product changelog (no login required). A curated,
 * chronological record of what shipped, styled as a quiet timeline: date +
 * tag on the left rail, the human-readable change on the right. Content SSOT
 * lives in `src/config/changelog.ts`.
 */
export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-14">
          <PageHeading className="mb-3">Changelog</PageHeading>
          <p className="max-w-2xl text-lg text-fg-secondary">
            What’s new on OrangeCat — building the Bitcoin-native personal economy in the open.
            Newest first.
          </p>
        </div>

        {/* Timeline */}
        <ol className="relative space-y-12 border-l border-default pl-6 sm:pl-8">
          {CHANGELOG.map((entry, i) => (
            <li key={`${entry.date}-${i}`} className="relative">
              {/* Dot on the rail */}
              <span
                aria-hidden
                className={`absolute -left-[calc(0.25rem+1px)] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full ring-4 ring-surface-page sm:-left-[calc(0.5rem+1px)] ${TAG_DOT[entry.tag]}`}
              />

              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <time dateTime={entry.date} className="font-mono text-xs text-fg-tertiary">
                  {formatIsoDay(entry.date)}
                </time>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-wide ${TAG_CHIP[entry.tag]}`}
                >
                  {CHANGELOG_TAGS[entry.tag].label}
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-display text-fg-primary">{entry.title}</h2>
              <p className="mt-1.5 text-fg-secondary">{entry.summary}</p>

              {entry.items && entry.items.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {entry.items.map((item, j) => (
                    <li key={j} className="flex gap-2.5 text-sm text-fg-secondary">
                      <span
                        aria-hidden
                        className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-strong"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>

        {/* Foot note */}
        <p className="mt-16 border-t border-default pt-8 text-sm text-fg-tertiary">
          Everything here shipped to production. Follow along —{' '}
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
