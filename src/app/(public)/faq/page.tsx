import Link from 'next/link';
import { Faq } from 'bip-kit/react';
import 'bip-kit/styles.css';
import '@/lib/longform/longform.css';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';
import { CONTACT_EMAIL } from '@/config/brand';
import { getFaqSections } from '@/lib/faq';

// content/faq.md only changes with a deploy, so the page is built once.
export const dynamic = 'force-static';

export default function FAQPage() {
  const sections = getFaqSections();

  return (
    <div className="min-h-screen pt-20 pb-24">
      <div className="border-b border-default bg-surface-page py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <PageHeading className="mb-4">Frequently Asked Questions</PageHeading>
          <p className="text-xl text-fg-secondary max-w-2xl mx-auto">
            Everything you need to know about OrangeCat — your AI economic agent.
          </p>
        </div>
      </div>

      {/* Two-column at lg+: sticky section list left, questions right. */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-8 lg:gap-12">
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1" aria-label="FAQ sections">
              {sections.map(section => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-md px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-12">
            <Faq sections={sections} />

            <div className="text-center bg-surface-raised border border-default rounded-lg p-8">
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Still have questions?</h3>
              <p className="text-fg-secondary mb-4">
                Ask the Cat directly — no account needed. It answers right away, and a human reads
                every message.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={ROUTES.FEEDBACK}
                  className="inline-flex items-center gap-2 bg-fg-primary hover:bg-muted-strong text-fg-inverted font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  Ask the Cat
                </Link>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-2 border border-default text-fg-primary hover:bg-surface-base font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  Contact us
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
