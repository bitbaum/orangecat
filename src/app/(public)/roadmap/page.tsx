import type { Metadata } from 'next';
import { CheckCircle2, Circle } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import {
  FLEET_PROFILE_URL,
  groupRoadmap,
  loadOrangeCatProfile,
  milestoneParts,
} from '@/lib/development/records';

export const metadata: Metadata = {
  title: 'Roadmap',
  description:
    'What OrangeCat supports today and the focused path to a Bitcoin fund-to-build loop.',
};

/**
 * /roadmap — rendered from the fleet map, never from a local copy. The record
 * is ROADMAP.md at the repository root; Loki's map ingests it. This page owns
 * the markup only.
 */
export default async function RoadmapPage() {
  const profile = await loadOrangeCatProfile();
  const buckets = profile ? groupRoadmap(profile.roadmap) : [];

  return (
    <main className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
            Product direction
          </p>
          <PageHeading className="mt-4">Roadmap</PageHeading>
          <p className="mt-5 text-lg text-fg-secondary sm:text-xl">
            First make public entities effortless to share, fund in Bitcoin, and turn into
            supervised Loki projects. Broaden the rails only after that loop is dependable.
          </p>
        </div>

        {profile === null ? (
          <p className="mt-14 rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            The roadmap is temporarily unavailable. It is read from the fleet map, which did not
            answer just now; try again in a few minutes.
          </p>
        ) : buckets.length === 0 ? (
          <p className="mt-14 rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            Nothing recorded yet.
          </p>
        ) : (
          <div className="mt-16 space-y-16">
            {buckets.map(bucket => (
              <section key={bucket.status} className="border-t border-default pt-10">
                <h2 className="font-mono text-xs uppercase tracking-caps text-fg-tertiary">
                  {bucket.title}
                </h2>
                <div className="mt-6 space-y-10">
                  {bucket.items.map(item => (
                    <article key={item.title}>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-2xl font-semibold tracking-display text-fg-primary">
                          {item.title}
                        </h3>
                        {item.targetDate && (
                          <span className="font-mono text-xs text-fg-tertiary">
                            {item.targetDate}
                          </span>
                        )}
                        {item.progress !== null && (
                          <span className="font-mono text-xs text-fg-tertiary">
                            {item.progress}%
                          </span>
                        )}
                      </div>
                      {item.milestones.length > 0 && (
                        <ul className="mt-4 space-y-3">
                          {item.milestones.map(m => {
                            const { title, done } = milestoneParts(m);
                            return (
                              <li key={title} className="flex gap-3 text-fg-secondary">
                                {done ? (
                                  <CheckCircle2
                                    className="mt-0.5 h-5 w-5 shrink-0 text-status-positive"
                                    aria-label="Done"
                                  />
                                ) : done === false ? (
                                  <Circle
                                    className="mt-0.5 h-5 w-5 shrink-0 text-fg-tertiary"
                                    aria-label="Not yet"
                                  />
                                ) : (
                                  <span
                                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-strong"
                                    aria-hidden
                                  />
                                )}
                                <span>{title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-16 border-t border-default pt-8 text-sm text-fg-tertiary">
          Read from the fleet map. The record is{' '}
          <a
            href="https://github.com/bitbaum/orangecat/blob/main/ROADMAP.md"
            className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            ROADMAP.md
          </a>{' '}
          in the repository; the project&apos;s place in the fleet is{' '}
          <a
            href={FLEET_PROFILE_URL}
            className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            on Loki
          </a>
          .
        </p>
      </div>
    </main>
  );
}
