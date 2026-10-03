import { Metadata } from 'next';
import { ExternalLink, GitFork } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CopyCommand } from '@/components/steal/CopyCommand';
import { StealQrCode } from '@/components/steal/StealQrCode';
import { ROUTES } from '@/config/routes';
import {
  STEALABLE_REPOS,
  STEAL_ORG_URL,
  STEAL_STEPS,
  STEAL_THE_CAT,
  SYSTEMS_THINKING_PROMPTS,
  cloneCommand,
  forkUrl,
  repoUrl,
} from '@/config/steal';

export const metadata: Metadata = {
  title: 'Steal the cat',
  description:
    'OrangeCat is MIT-licensed. Use it as it is, or take the code, change it and own your copy. No permission needed.',
  openGraph: {
    title: 'Steal the cat',
    description: 'Use it, or take the code and make it yours. MIT, no permission needed.',
    type: 'website',
  },
};

/**
 * /steal — the "Steal the cat" campaign, where the poster QR code lands.
 * Two doors, equal weight: use OrangeCat, or take it. Nothing stands in front
 * of the second door — no form, no account, no request — because MIT means
 * none is needed. All copy and links come from config/steal.ts.
 */
export default function StealPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <section className="border-b border-default">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-caps text-fg-tertiary">
            Open source · MIT
          </p>
          <h1 className="mt-4 font-heading tracking-display text-4xl font-bold text-fg-primary sm:text-6xl">
            Steal the cat.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-secondary sm:text-xl">
            We build technology to release it. Use OrangeCat as it is, or take the whole thing,
            change it and run it as your own. You don&apos;t need to ask us first.
          </p>
          <div className="mt-10 grid-cols-safe grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-default bg-surface-base p-6">
              <h2 className="text-lg font-semibold text-fg-primary">Use it</h2>
              <p className="mt-2 text-fg-secondary">
                Create an account and let your Cat get to work. It&apos;s free to start.
              </p>
              <Button href={ROUTES.AUTH_REGISTER} variant="accent" className="mt-5">
                Start using OrangeCat
              </Button>
            </div>
            <div className="rounded-xl border border-default bg-surface-base p-6">
              <h2 className="text-lg font-semibold text-fg-primary">Take it</h2>
              <p className="mt-2 text-fg-secondary">
                Fork the code and it&apos;s yours: your name, your server, your rules.
              </p>
              <Button href={forkUrl(STEAL_THE_CAT.repo)} variant="outline" className="mt-5">
                <GitFork className="mr-2 h-4 w-4" />
                Fork it on GitHub
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-heading tracking-display text-2xl font-semibold text-fg-primary">
          From &ldquo;I like it&rdquo; to &ldquo;it&apos;s mine&rdquo;
        </h2>
        <ol className="mt-8 grid-cols-safe grid gap-6 md:grid-cols-3">
          {STEAL_STEPS.map((step, index) => (
            <li key={step.title} className="min-w-0">
              <span className="font-mono text-sm text-fg-tertiary">0{index + 1}</span>
              <h3 className="mt-1 text-lg font-semibold text-fg-primary">{step.title}</h3>
              <p className="mt-2 text-fg-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 max-w-2xl space-y-2">
          <CopyCommand command={`${cloneCommand(STEAL_THE_CAT.repo)} && cd my-${STEAL_THE_CAT.repo} && pnpm install`} />
          <p className="text-sm text-fg-tertiary">You&apos;ll need {STEAL_THE_CAT.needs}.</p>
        </div>
      </section>

      <section className="border-y border-default bg-surface-base">
        <div className="mx-auto grid-cols-safe grid max-w-shell items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="min-w-0">
            <h2 className="font-heading tracking-display text-2xl font-semibold text-fg-primary">
              Pass it on
            </h2>
            <p className="mt-4 text-fg-secondary">
              This code opens this page. Print it, stick it up, put it on a slide. Whoever scans it
              can use the cat or steal it.
            </p>
          </div>
          <StealQrCode />
        </div>
      </section>

      <section className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-heading tracking-display text-2xl font-semibold text-fg-primary">
          The rest of the fleet is yours too
        </h2>
        <p className="mt-4 max-w-2xl text-fg-secondary">
          Bitbaum is a platform for the new economy and for creation: building, engineering and
          researching. Every project below is public and MIT-licensed.
        </p>
        <ul className="mt-8 grid-cols-safe grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEALABLE_REPOS.map(item => (
            <li key={item.repo} className="min-w-0 rounded-xl border border-default bg-surface-base p-5">
              <a
                href={repoUrl(item.repo)}
                className="inline-flex items-center gap-1 font-semibold text-fg-primary hover:underline"
              >
                {item.name}
                <ExternalLink className="h-3.5 w-3.5 text-fg-tertiary" />
              </a>
              <p className="mt-2 text-sm text-fg-secondary">{item.what}</p>
              <p className="mt-3 text-xs text-fg-tertiary">Needs: {item.needs}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-fg-tertiary">
          Everything else is at{' '}
          <a href={STEAL_ORG_URL} className="underline hover:text-fg-primary">
            github.com/bitbaum
          </a>
          .
        </p>
      </section>

      <section className="border-t border-default">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="font-heading tracking-display text-2xl font-semibold text-fg-primary">
            Want to build it with us? Show us how you think.
          </h2>
          <p className="mt-4 max-w-2xl text-fg-secondary">
            We work as engineers in the loop: agents do much of the typing, and people own the
            judgement. Copying code is free. What stays scarce once agents and robots write most of
            it is seeing the whole system. Pick one of these, in any of our repos, and open an issue
            or a pull request.
          </p>
          <ol className="mt-8 grid-cols-safe grid gap-6 md:grid-cols-3">
            {SYSTEMS_THINKING_PROMPTS.map(prompt => (
              <li key={prompt.title} className="min-w-0 rounded-xl border border-default p-5">
                <h3 className="font-semibold text-fg-primary">{prompt.title}</h3>
                <p className="mt-2 text-sm text-fg-secondary">{prompt.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-fg-tertiary">
            A short, correct answer beats a long one, and so does an answer that admits what it
            doesn&apos;t know. The OrangeCat name and logo aren&apos;t part of the licence, so ship
            your copy under a name of your own.
          </p>
        </div>
      </section>
    </div>
  );
}
