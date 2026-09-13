import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { CURRENT_CAPABILITIES, ROADMAP_PHASES } from '@/config/public-content';

export const metadata: Metadata = {
  title: 'Roadmap',
  description: 'What OrangeCat supports today and the focused path to a Bitcoin fund-to-build loop.',
};

export default function RoadmapPage() {
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

        <section className="mt-14 rounded-lg border border-default bg-surface-base p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-fg-primary">Available today</h2>
          <ul className="mt-5 space-y-3">
            {CURRENT_CAPABILITIES.map(item => (
              <li key={item} className="flex gap-3 text-fg-secondary">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-positive" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 space-y-16">
          {ROADMAP_PHASES.map(phase => (
            <section key={phase.marker} className="border-t border-default pt-10">
              <p className="font-mono text-xs text-fg-tertiary">{phase.marker}</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-display text-fg-primary">
                {phase.title}
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-fg-secondary">{phase.summary}</p>
              <ul className="mt-6 space-y-3">
                {phase.items.map(item => (
                  <li key={item} className="flex gap-3 text-fg-secondary">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-strong" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
