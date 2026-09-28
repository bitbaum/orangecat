import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { LADDER, PARTNERS_PAGE, foundGuildHref, guildHref } from '@/config/partners';
import { getPartnersDirectory, type Partner } from '@/domain/partners/service';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: PARTNERS_PAGE.title, description: PARTNERS_PAGE.lede };
export const dynamic = 'force-dynamic';

function PartnerCard({ partner }: { partner: Partner }) {
  const shipped = Object.entries(partner.portfolio.counts).filter(([, n]) => (n ?? 0) > 0);
  const body = (
    <>
      <span className="block font-heading text-lg text-fg-primary">{partner.displayName}</span>
      <span className="mt-1 block text-sm text-fg-secondary">
        {PARTNERS_PAGE.partners.portfolio(partner.portfolio.total)}
      </span>
      {shipped.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-tertiary">
          {shipped.map(([type, n]) => (
            <span key={type}>
              {n} {ENTITY_REGISTRY[type as keyof typeof ENTITY_REGISTRY].namePlural.toLowerCase()}
            </span>
          ))}
        </span>
      )}
    </>
  );
  const className = 'block rounded-lg border border-default bg-surface-base p-5';
  return (
    <li>
      {partner.href ? (
        <Link href={partner.href} className={`${className} hover:border-interactive`}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

export default async function PartnersPage() {
  const supabase = await createServerClient();
  const directory = await getPartnersDirectory(supabase);
  return (
    <div className="min-h-screen bg-surface-page pb-16">
      <div className="container mx-auto max-w-5xl px-4">
        <header className="py-12 sm:py-16">
          <PageHeading>{PARTNERS_PAGE.title}</PageHeading>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-fg-secondary">
            {PARTNERS_PAGE.lede}
          </p>
        </header>

        <ol className="grid gap-4 md:grid-cols-3">
          {LADDER.map((rung, i) => (
            <li
              key={rung.id}
              className="flex flex-col rounded-lg border border-default bg-surface-base p-5"
            >
              <span className="font-heading text-sm text-fg-muted">{i + 1}</span>
              <h2 className="mt-1 font-heading text-xl text-fg-primary">{rung.title}</h2>
              <p className="mt-2 text-sm font-medium text-fg-primary">{rung.who}</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{rung.what}</p>
              <p className="mt-2 text-sm text-fg-tertiary">{rung.price}</p>
              <Link
                href={rung.cta.href}
                className="mt-4 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-fg-primary hover:underline"
              >
                {rung.cta.label}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>

        <section id="partners" aria-labelledby="partners-title" className="mt-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-3xl">
              <h2 id="partners-title" className="font-heading text-2xl text-fg-primary">
                {PARTNERS_PAGE.partners.title}
              </h2>
              <p className="mt-1 text-base leading-relaxed text-fg-secondary">
                {PARTNERS_PAGE.partners.lede}
              </p>
            </div>
            {directory.guild && (
              <Link
                href={guildHref()}
                className="inline-flex min-h-11 items-center rounded-lg bg-accent-warm px-4 text-sm font-semibold text-on-accent"
              >
                {PARTNERS_PAGE.partners.apply}
              </Link>
            )}
          </div>
          {directory.guild ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {directory.partners.map(partner => (
                <PartnerCard key={partner.userId} partner={partner} />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-default bg-surface-base p-6">
              <p className="text-sm text-fg-secondary">{PARTNERS_PAGE.partners.empty}</p>
              <Link
                href={foundGuildHref()}
                className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg border border-default bg-surface-base px-4 text-sm font-semibold text-fg-primary hover:border-interactive"
              >
                {PARTNERS_PAGE.partners.found}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
