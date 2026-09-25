'use client';

/**
 * HOW CAT RUNS — what powers Cat and what it costs.
 *
 * Moved from /settings/ai so the Cat settings page and that page render one
 * implementation. Four ways, cheapest first: the free pool (default, daily
 * cap), prepaid Cat Credits, your own key, your own machine.
 */

import Link from 'next/link';
import { Bot, Check, Server, Terminal } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { CAT_FRONTIER_MODELS_OR } from '@/config/cat-plans';
import { useAISettings } from '@/hooks/useAISettings';
import { SharedCapacityCard } from '@/components/ai/SharedCapacityCard';
import { AIKeyManager } from '@/components/ai/AIKeyManager';
import { CatCreditsPanel } from '@/components/ai/CatCreditsPanel';
import { LocalRuntimePanel } from '@/components/ai/LocalRuntimePanel';
import { AiUsageStrip } from '@/components/ai/AiUsageStrip';

const CARD = 'scroll-mt-28 rounded-lg border border-default bg-surface-base p-5 sm:p-6';

function Active() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-status-positive/30 bg-status-positive-subtle px-2 py-0.5 text-xs font-medium text-status-positive">
      <Check className="h-3 w-3" /> In use
    </span>
  );
}

function CardHead({
  icon: Icon,
  title,
  active,
  children,
}: {
  icon: typeof Bot;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-md bg-surface-raised p-2">
        <Icon className="h-5 w-5 text-fg-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-fg-primary">{title}</h3>
          {active && <Active />}
        </div>
        <div className="mt-1 space-y-2 text-sm text-fg-secondary">{children}</div>
      </div>
    </div>
  );
}

export function RunsOnSection() {
  const { keys, preferences, isLoading, hasByok, addKey, deleteKey, setPrimaryKey, reorderKeys } =
    useAISettings();

  return (
    <div className="space-y-4">
      <AiUsageStrip />
      <SharedCapacityCard />

      <section className={CARD}>
        <CardHead icon={Bot} title="Free pool" active={!hasByok}>
          <p>
            Works out of the box on OrangeCat&apos;s own provider keys — nothing to add, nothing to
            pay, a daily cap. Good for chat and drafting; discovery and multi-step work are best on
            a frontier model ({CAT_FRONTIER_MODELS_OR}).
          </p>
        </CardHead>
      </section>

      <div id="credits" className="scroll-mt-28">
        <CatCreditsPanel />
      </div>

      <section id="byok" className={CARD}>
        <CardHead icon={Server} title="Your own key" active={hasByok}>
          <p>
            Any provider, direct or through OpenRouter. You pay them; OrangeCat never sees your
            bill. Only keys <em>you</em> own appear here.
          </p>
        </CardHead>
        <div className="mt-4">
          <AIKeyManager
            keys={keys}
            onAdd={addKey}
            onDelete={deleteKey}
            onSetPrimary={setPrimaryKey}
            onReorder={reorderKeys}
            platformPosition={preferences?.platform_chain_position ?? 0}
            isLoading={isLoading}
          />
        </div>
      </section>

      <section id="local" className={CARD}>
        <CardHead icon={Terminal} title="Your own machine">
          <p>Cat talks to a model on your computer. Nothing leaves it; free forever.</p>
        </CardHead>
        <div className="mt-4">
          <LocalRuntimePanel />
        </div>
      </section>

      <p className="text-xs text-fg-tertiary">
        Keys are encrypted at rest and never logged.{' '}
        <Link
          href={ROUTES.HOW_CAT_RUNS}
          className="underline underline-offset-2 hover:no-underline"
        >
          How Cat runs
        </Link>{' '}
        explains what each option costs and what each is bad at.
      </p>
    </div>
  );
}
