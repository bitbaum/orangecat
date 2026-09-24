import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';
import { WHITEPAPER_SECTIONS } from '@/config/public-content';

export const metadata: Metadata = {
  title: 'Whitepaper',
  description: 'The OrangeCat and Loki thesis: fund what people build, and build what people fund.',
};

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-surface-page">
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <header className="border-b border-default pb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-fg-tertiary">
            <span className="rounded-full border border-default px-2.5 py-1">WHITEPAPER</span>
            <span>v0.2</span>
            <span>September 2026</span>
          </div>
          <PageHeading className="mt-6">
            Fund what people build. Build what people fund.
          </PageHeading>
          <p className="mt-5 text-lg leading-relaxed text-fg-secondary">
            A focused architecture for connecting public economic coordination on OrangeCat with
            supervised agent execution on Loki.
          </p>
        </header>

        <div className="space-y-14 py-12">
          {WHITEPAPER_SECTIONS.map((section, index) => (
            <section key={section.title}>
              <p className="font-mono text-xs text-fg-tertiary">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-display text-fg-primary">
                {section.title}
              </h2>
              <div className="mt-5 space-y-4 text-base leading-7 text-fg-secondary">
                {section.paragraphs.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="border-t border-default pt-8">
          <Link
            href={ROUTES.ROADMAP}
            className="inline-flex items-center gap-2 font-medium text-fg-primary hover:underline"
          >
            See the implementation sequence
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </footer>
      </article>
    </main>
  );
}
