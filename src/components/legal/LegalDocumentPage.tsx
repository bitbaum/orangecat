import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { CONTACT_EMAIL } from '@/config/brand';
import { LEGAL_DRAFT_NOTICE, type LegalDocument } from '@/config/legal-content';
import { ROUTES } from '@/config/routes';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { cn } from '@/lib/utils';
import { linkify } from './linkify';

/** A paragraph whose email and web addresses are links. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, i) =>
        part.kind === 'link' ? (
          <a key={i} href={part.href} className="oc-text-link">
            {part.text}
          </a>
        ) : (
          part.text
        )
      )}
    </>
  );
}

/**
 * Shared renderer for the /privacy and /terms pages. Content lives in
 * src/config/legal-content.ts (SSOT); this component owns layout only.
 */
export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <div className="min-h-screen bg-surface-page">
      <article className={cn(PUBLIC_PAGE_WIDTH.reading, 'pb-16')}>
        <PublicPageHeader
          align="start"
          title={document.title}
          meta={`Last updated: ${document.lastUpdated}`}
        />
        <div className="border-b border-default pb-8">
          {document.draft && (
            <div className="flex items-start gap-3 rounded-lg border border-default bg-surface-raised/40 p-4">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-fg-secondary"
                aria-hidden
              />
              <p className="text-sm leading-6 text-fg-secondary">{LEGAL_DRAFT_NOTICE}</p>
            </div>
          )}
          <div className="mt-6 space-y-4 text-base leading-7 text-fg-secondary">
            {document.intro.map(paragraph => (
              <p key={paragraph}>
                <Rich text={paragraph} />
              </p>
            ))}
          </div>
        </div>

        <div className="space-y-10 py-10">
          {document.sections.map((section, index) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-fg-primary">
                {index + 1}. {section.heading}
              </h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-fg-secondary">
                {section.paragraphs?.map(paragraph => (
                  <p key={paragraph}>
                    <Rich text={paragraph} />
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-2 pl-6">
                    {section.bullets.map(bullet => (
                      <li key={bullet}>
                        <Rich text={bullet} />
                      </li>
                    ))}
                  </ul>
                )}
                {section.closing?.map(paragraph => (
                  <p key={paragraph}>
                    <Rich text={paragraph} />
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mb-0 border-t border-default pt-8 text-base leading-7 text-fg-secondary">
          A question about this?{' '}
          <Link href={ROUTES.FEEDBACK} className="oc-text-link">
            Ask the Cat
          </Link>
          , or write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="oc-text-link">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </article>
    </div>
  );
}
