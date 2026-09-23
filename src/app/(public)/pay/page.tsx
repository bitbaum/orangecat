/**
 * `/pay` — public landing page explaining pay links.
 *
 * The working product (`/pay/<username>`) existed with zero public surface
 * pointing at it: bare /pay 404'd and nothing linked the feature. This page is
 * the discoverability half — what a pay link is, why it's different from an
 * invoice or a processor, and the two ways in (find someone / get your own).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Link2, ShieldCheck, UserX } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SITE_URL } from '@/config/brand';
import { PAY_LANDING_COPY } from '@/config/pay';
import { ROUTES } from '@/config/routes';

const POINT_ICONS = [UserX, ShieldCheck, Link2] as const;

export const metadata: Metadata = {
  title: 'Get paid',
  description: PAY_LANDING_COPY.subtitle,
  alternates: { canonical: `${SITE_URL}${ROUTES.PAY_LANDING}` },
  openGraph: {
    title: PAY_LANDING_COPY.title,
    description: PAY_LANDING_COPY.subtitle,
    url: `${SITE_URL}${ROUTES.PAY_LANDING}`,
    type: 'website',
  },
};

export default function PayLandingPage() {
  return (
    <div className="min-h-screen bg-surface-page pt-24 pb-24 text-fg-primary">
      <div className="mx-auto w-full max-w-3xl px-5">
        <header className="mb-14 text-center">
          <h1 className="text-4xl font-bold tracking-display text-fg-primary sm:text-5xl">
            {PAY_LANDING_COPY.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-secondary">
            {PAY_LANDING_COPY.subtitle}
          </p>
        </header>

        <div className="mx-auto mb-14 flex w-full max-w-xl flex-col gap-6">
          {PAY_LANDING_COPY.points.map((point, index) => {
            const Icon = POINT_ICONS[index] ?? Link2;
            return (
              <div
                key={point.title}
                className="rounded-lg border border-subtle bg-surface-base p-6"
              >
                <Icon className="mb-4 h-6 w-6 text-fg-secondary" aria-hidden />
                <h2 className="mb-2 text-base font-semibold text-fg-primary">{point.title}</h2>
                <p className="text-sm leading-relaxed text-fg-secondary">{point.description}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href={ROUTES.AUTH_REGISTER}>
              <Button size="lg" variant="accent">
                {PAY_LANDING_COPY.ctaOwn}
              </Button>
            </Link>
            <Link href={ROUTES.DISCOVER}>
              <Button size="lg" variant="outline">
                {PAY_LANDING_COPY.ctaFind}
              </Button>
            </Link>
          </div>
          <p className="text-sm text-fg-tertiary">{PAY_LANDING_COPY.ctaOwnHint}</p>
        </div>
      </div>
    </div>
  );
}
