import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift, Coins, KeyRound, Laptop, ArrowRight } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';
import {
  CAT_FREE_DAILY_LIMIT,
  CAT_CREDITS_MARKUP_LABEL,
  CAT_WIRED_PROVIDERS,
} from '@/config/cat-plans';
import { LOCAL_RUNTIMES } from '@/config/local-ai';

export const metadata: Metadata = {
  title: 'How Cat runs',
  description:
    'The four ways to power your Cat — the free pool, Cat Credits, your own API key, or a model on your own machine. What each costs, what each means for your privacy, and what each is bad at.',
};

/**
 * /docs/how-cat-runs — the ONE place this is explained.
 *
 * It exists because the same facts were being restated on /settings/ai,
 * /settings/usage and /pricing, and they had already drifted apart: one screen
 * said credits were priced near cost while the screen beside it quoted the
 * real markup. Prose that is repeated is prose that disagrees with itself
 * eventually, which is the same rule this codebase applies to entity lists.
 *
 * So every number here is DERIVED from the config that governs it. Nothing on
 * this page is typed twice, including the free allowance and the markup.
 * Other surfaces link here; they do not re-explain.
 */

interface Route {
  id: string;
  name: string;
  icon: typeof Gift;
  cost: string;
  privacy: string;
  goodAt: string;
  badAt: string;
  setup: string;
}

const ROUTES_TO_POWER: Route[] = [
  {
    id: 'free',
    name: 'The free pool',
    icon: Gift,
    cost: `Nothing. ${CAT_FREE_DAILY_LIMIT} messages a day, reset at midnight UTC.`,
    privacy:
      "Your messages go to OrangeCat's AI providers under OrangeCat's own accounts. We never sell them, and they are not training data for us — but they do leave your device.",
    goodAt: 'Chat, drafting, asking what something means, trying Cat out with no setup at all.',
    badAt:
      'Long research, careful multi-step work, and anything needing a frontier model. The pool is shared by everyone, so it is also the route most likely to be busy.',
    setup: 'None. It is already on.',
  },
  {
    id: 'credits',
    name: 'Cat Credits',
    icon: Coins,
    cost: `${CAT_CREDITS_MARKUP_LABEL}, charged at the Bitcoin rate at the moment you spend. Top up over Lightning; no card, no subscription.`,
    privacy:
      "Same as the free pool — the request goes through OrangeCat's accounts. The difference is which model answers, not who carries the message.",
    goodAt:
      'Frontier models without opening accounts at four providers. Image generation. Paying for exactly what you use and nothing more.',
    badAt:
      'Predictable monthly budgeting — usage-priced means a heavy week costs more than a light one.',
    setup: 'Top up once. Nothing to configure.',
  },
  {
    id: 'byok',
    name: 'Your own API key',
    icon: KeyRound,
    cost: 'Nothing to OrangeCat. Your provider bills you directly, at their price, with no markup from us.',
    privacy:
      'Your messages go to the provider you chose, under your own account, governed by their terms — not ours. OrangeCat stores the key encrypted and never shows it again.',
    goodAt:
      'The best economics of any route, and the most control. If you already pay for an AI provider, this costs you nothing extra.',
    badAt: 'Needing an account and a payment method with that provider first.',
    setup: `One key. ${CAT_WIRED_PROVIDERS.join(', ')} are wired direct.`,
  },
  {
    id: 'local',
    name: 'A model on your own machine',
    icon: Laptop,
    cost: 'Nothing but electricity. No account, no bill, no rate limit.',
    privacy:
      'The strongest guarantee we can offer: the conversation never leaves your computer. Not to us, not to a provider, not to anyone.',
    goodAt: 'Private drafting and thinking, offline work, and never being metered.',
    badAt:
      'Taking ACTIONS. Small local models are weak at tool calling, which is most of what makes Cat useful — it will chat well and then struggle to actually create the listing, send the message, or update the draft. It also does not work on a phone.',
    setup: `${LOCAL_RUNTIMES.map(r => r.name).join(' or ')} on the same machine as your browser, with OrangeCat allowed as an origin.`,
  },
];

export default function HowCatRunsPage() {
  return (
    <div className="min-h-screen bg-surface-page py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeading>How Cat runs</PageHeading>
        <p className="mt-3 text-lg text-fg-secondary">
          Cat is an AI agent, and something has to pay for the thinking. There are four ways, you
          can mix them, and none of them is hidden from you.
        </p>

        <p className="mt-6 text-fg-secondary">
          Cat works the moment you sign up, free, with nothing to set up. Everything below is
          optional power. OrangeCat earns from activity on the platform — not from marking up your
          AI bill — which is why two of these four routes send us no money at all and we still wired
          them.
        </p>

        <div className="mt-10 space-y-6">
          {ROUTES_TO_POWER.map(route => {
            const Icon = route.icon;
            return (
              <section
                key={route.id}
                className="rounded-lg border border-default bg-surface-base p-6"
                aria-labelledby={`route-${route.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-surface-raised p-2">
                    <Icon className="h-5 w-5 text-fg-primary" aria-hidden />
                  </div>
                  <h2 id={`route-${route.id}`} className="text-lg font-semibold text-fg-primary">
                    {route.name}
                  </h2>
                </div>

                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
                      What it costs
                    </dt>
                    <dd className="mt-1 text-sm text-fg-secondary">{route.cost}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
                      Where your words go
                    </dt>
                    <dd className="mt-1 text-sm text-fg-secondary">{route.privacy}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
                      Good at
                    </dt>
                    <dd className="mt-1 text-sm text-fg-secondary">{route.goodAt}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary">
                      Bad at
                    </dt>
                    <dd className="mt-1 text-sm text-fg-secondary">{route.badAt}</dd>
                  </div>
                </dl>

                <p className="mt-4 border-t border-subtle pt-3 text-sm text-fg-tertiary">
                  <span className="font-medium text-fg-secondary">Setup:</span> {route.setup}
                </p>
              </section>
            );
          })}
        </div>

        <section className="mt-10 rounded-lg border border-default bg-surface-raised/30 p-6">
          <h2 className="text-lg font-semibold text-fg-primary">You can mix them</h2>
          <p className="mt-2 text-sm text-fg-secondary">
            These are not four plans you pick between — they are four routes, and you can hold all
            of them at once. Most people stay on the free pool, add a key for the work that needs a
            better model, and never think about it again. Cat uses your own key when you have one
            and falls back to the free pool when you don&apos;t.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={ROUTES.SETTINGS_AI}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-interactive bg-surface-raised px-4 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised/70"
          >
            Set this up
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={ROUTES.PRICING}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-subtle px-4 py-2 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </div>
  );
}
