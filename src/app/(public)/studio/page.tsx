import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Coins } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { CTA_LABELS, FEE_CLAIMS } from '@/config/landing-page';
import { STUDIO_MEDIA, STUDIO_MEDIUMS, STUDIO_NEXT_MOVES } from '@/config/studio';

export const metadata: Metadata = {
  title: 'Studio',
  description:
    'Make video, music, writing and artwork on OrangeCat — then change it by saying what to change. Finance the work as a project, sell it as a product, settle in Bitcoin.',
  openGraph: {
    title: 'The OrangeCat Studio',
    description: 'Make it. Change it by talking to it. Finance it. Get paid.',
    type: 'website',
  },
};

/**
 * Public marketing page for the Studio. The signed-in surface is
 * ROUTES.DASHBOARD.STUDIO; everything described here is derived from
 * src/config/studio.ts, so the page cannot promise a medium the product does
 * not have.
 */
export default function StudioMarketingPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <header className="border-b border-subtle bg-surface-base">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="font-heading tracking-display text-4xl font-bold text-fg-primary sm:text-5xl">
            You don&rsquo;t have to be a musician to change a song.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-secondary">
            Everyone is a listener. Everyone knows when the middle drags or the light is too cold.
            The Studio lets you say that in ordinary words — and the work changes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href={`${ROUTES.AUTH}?mode=register`} variant="accent" size="lg">
              {CTA_LABELS.primaryAction}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button href={ROUTES.HOW_IT_WORKS} variant="outline" size="lg">
              {CTA_LABELS.learnMore}
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold text-fg-primary">What you can make</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {STUDIO_MEDIUMS.map(id => {
            const meta = STUDIO_MEDIA[id];
            const Icon = meta.icon;
            return (
              <li key={id} className="oc-surface p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-fg-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                  {meta.name}
                </h3>
                <p className="mt-2 text-fg-secondary">{meta.tagline}</p>
                <p className="mt-3 text-sm text-fg-tertiary">{meta.examples.join(' · ')}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border-y border-subtle bg-surface-base">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-fg-primary">How changing it works</h2>
          <ol className="mt-8 space-y-6">
            {[
              {
                title: 'Say what you want',
                body: 'A sentence is enough. "A slow instrumental — upright bass, brushed drums, one trumpet, late-night."',
              },
              {
                title: 'Look at it. Listen to it.',
                body: 'The version plays in the page. This is the part that matters: you judge it as an audience, not as a technician.',
              },
              {
                title: 'Say what is wrong with it',
                body: '"The middle drags. Bring the trumpet in earlier and make the ending softer." That becomes the next version. No craft vocabulary, no settings to learn.',
              },
              {
                title: 'Keep going until it is right',
                body: 'Every version is kept, so you can always say the last one was better.',
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-default text-sm font-semibold text-fg-primary">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-fg-primary">{step.title}</h3>
                  <p className="mt-1 text-fg-secondary">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold text-fg-primary">Then it earns</h2>
        <p className="mt-2 max-w-2xl text-fg-secondary">
          A studio that only makes things is a toy. Everything you make here has somewhere to go,
          and {FEE_CLAIMS.creatorShare} of what people pay reaches you.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {STUDIO_NEXT_MOVES.map(move => (
            <li key={move.id} className="oc-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-fg-primary">
                <Coins className="h-5 w-5" aria-hidden />
                {move.title}
              </h3>
              <p className="mt-2 text-fg-secondary">{move.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-lg border border-default bg-surface-base p-6">
          <h3 className="font-semibold text-fg-primary">What it costs</h3>
          <p className="mt-2 text-fg-secondary">
            Writing runs on OrangeCat&rsquo;s own free models. Video, music and artwork run on your
            own AI key, so you pay your provider directly and OrangeCat takes{' '}
            {FEE_CLAIMS.platformFee} of it — we would rather say that than quietly meter you.
          </p>
          <Link
            href={ROUTES.PRICING}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-fg-primary"
          >
            See the plans
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
