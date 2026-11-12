import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { WHITEPAPER_SECTIONS } from '@/config/public-content';

export const metadata: Metadata = {
  title: 'Whitepaper',
  description: 'The OrangeCat and Loki thesis: fund what people build, and build what people fund.',
};

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <article className={cn(PUBLIC_PAGE_WIDTH.reading, 'pb-16')}>
        <PublicPageHeader
          align="start"
          eyebrow="Whitepaper · v0.1 · July 2026"
          title="Fund what people build. Build what people fund."
          lede="A focused architecture for connecting public economic coordination on OrangeCat with supervised agent execution on Loki."
        />

        <div className="space-y-14 pb-12">
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
    </div>
  );
}
