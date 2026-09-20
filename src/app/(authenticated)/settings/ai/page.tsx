'use client';

/**
 * /settings/ai — three-mode AI configuration page.
 *
 * Layout matches the freedom architecture: Managed (default, free with cap),
 * Bring Your Own Key (any provider, you pay them directly), and Local (run
 * inference on your own machine). Each mode is presented as an honest card
 * with real status, not a tier picker.
 *
 * Drops the AIModelPreferences tier picker (decorative — auto-router picks
 * the best free model already), the AIUsageStats panel (the QuotaMeter chip
 * in /dashboard/cat shows the same number with less ceremony), and the
 * right-sidebar guidance (added noise).
 */

import { SharedCapacityCard } from '@/components/ai/SharedCapacityCard';
import Link from 'next/link';
import { Bot, Check, Server, Terminal } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { CAT_FRONTIER_MODELS_OR } from '@/config/cat-plans';
import { useRequireAuth } from '@/hooks/useAuth';
import { useAISettings } from '@/hooks/useAISettings';
import Loading from '@/components/Loading';
import { AIKeyManager } from '@/components/ai/AIKeyManager';
import { CatCreditsPanel } from '@/components/ai/CatCreditsPanel';
import { LocalRuntimePanel } from '@/components/ai/LocalRuntimePanel';
import { AiUsageStrip } from '@/components/ai/AiUsageStrip';

export default function AISettingsPage() {
  const { user, hydrated, isLoading: authLoading } = useRequireAuth();

  const {
    keys,
    preferences,
    isLoading: settingsLoading,
    hasByok,
    addKey,
    deleteKey,
    setPrimaryKey,
    reorderKeys,
  } = useAISettings();

  if (!hydrated || authLoading) {
    return <Loading fullScreen />;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-12">
      {/* Live status strip — the numbers live on /settings/usage; this one
          line connects config to consumption so neither tab is a dead end. */}
      {/* One canonical explanation, linked — not restated here. Restating it
          is how two different markup claims ended up on adjacent screens. */}
      <p className="text-sm text-fg-secondary">
        Four ways to power Cat — free pool, credits, your own key, or your own machine.{' '}
        <Link
          href={ROUTES.HOW_CAT_RUNS}
          className="underline underline-offset-2 hover:no-underline"
        >
          How Cat runs
        </Link>{' '}
        explains what each costs and what each is bad at.
      </p>

      <AiUsageStrip />
      <SharedCapacityCard />

      {/* ════ Group 1 · How Cat runs ═══════════════════════════════════════ */}
      <section aria-labelledby="how-cat-runs" className="space-y-4">
        <div>
          <h2
            id="how-cat-runs"
            className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary"
          >
            How Cat runs
          </h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Cat already works — free, no setup needed. Everything below is optional power: prepaid
            credits, your own keys, or your own machine. OrangeCat earns from platform activity, not
            from your AI bill.
          </p>
        </div>

        {/* ── Managed ───────────────────────────────────────────────────── */}
        <section className="rounded-lg border border-default bg-surface-base p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-md bg-surface-raised p-2">
              <Bot className="h-5 w-5 text-fg-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-fg-primary">Use OrangeCat</h2>
                {!hasByok && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-status-positive/30 bg-status-positive-subtle px-2 py-0.5 text-xs font-medium text-status-positive">
                    <Check className="h-3 w-3" /> Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-fg-secondary">
                Free out of the box: Cat runs on <strong>OrangeCat&apos;s own provider keys</strong>{' '}
                (Groq, OpenRouter and others) — you never add or pay for these. No setup, daily cap.
                See{' '}
                <Link href={ROUTES.PRICING} className="underline hover:no-underline">
                  pricing
                </Link>{' '}
                for every plan — Supporter, your own key, and Cat Credits.
              </p>
              <p className="mt-2 text-xs text-fg-tertiary">
                Capability: <span className="font-medium text-fg-secondary">Capable</span> — great
                for chat, drafting, and suggestions. Discovery, matchmaking, and multi-step tasks
                work best on a <span className="font-medium text-fg-secondary">frontier</span> model
                — add a {CAT_FRONTIER_MODELS_OR} key below to unlock them.
              </p>
            </div>
          </div>
        </section>

        {/* ── Cat Credits (pay with Bitcoin) ────────────────────────────── */}
        <div id="credits" className="scroll-mt-24">
          <CatCreditsPanel />
        </div>

        {/* ── BYOK ──────────────────────────────────────────────────────── */}
        <section
          id="byok"
          className="scroll-mt-24 rounded-lg border border-default bg-surface-base p-6"
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-md bg-surface-raised p-2">
              <Server className="h-5 w-5 text-fg-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-fg-primary">Bring your own key</h2>
                {hasByok && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-status-positive/30 bg-status-positive-subtle px-2 py-0.5 text-xs font-medium text-status-positive">
                    <Check className="h-3 w-3" /> Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-fg-secondary">
                Use any provider — direct or aggregator. You pay them, OrangeCat never sees your
                bill. Claude, GPT and Grok are wired direct, so their own key works as-is; an
                OpenRouter key fronts 200+ models with one key instead.
              </p>
              <p className="mt-2 text-xs text-fg-tertiary">
                Seeing Groq or OpenRouter in chat but nothing listed here? That&apos;s the free pool
                running on <span className="font-medium text-fg-secondary">OrangeCat&apos;s</span>{' '}
                keys. This section is only for keys <em>you</em> own — it&apos;s empty until you add
                one.
              </p>
            </div>
          </div>
          <AIKeyManager
            keys={keys}
            onAdd={addKey}
            onDelete={deleteKey}
            onSetPrimary={setPrimaryKey}
            onReorder={reorderKeys}
            platformPosition={preferences?.platform_chain_position ?? 0}
            isLoading={settingsLoading}
          />
        </section>

        {/* ── Local ─────────────────────────────────────────────────────── */}
        <section
          id="local"
          className="scroll-mt-24 rounded-lg border border-default bg-surface-base p-6"
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-md bg-surface-raised p-2">
              <Terminal className="h-5 w-5 text-fg-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-fg-primary">Run locally</h2>
              <p className="mt-1 text-sm text-fg-secondary">
                Cat talks to a model running on your own machine. Nothing leaves the laptop. Free
                forever. Limited by your hardware (8B–70B models run on most laptops).
              </p>
            </div>
          </div>
          <LocalRuntimePanel />
        </section>
      </section>

      {/* ════ Group 2 · What Cat knows ═════════════════════════════════════ */}
      {/* What Cat knows moved to its own page. Billing is a setup surface;
          memory is a data surface you return to in order to read, correct and
          delete. Stacking them made one scroll answer three questions. */}
      <section className="rounded-lg border border-default bg-surface-base p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-fg-primary">What Cat knows</h2>
            <p className="mt-1 text-sm text-fg-secondary">
              Memories, standing instructions, interests and imported context now live on their own
              page.
            </p>
          </div>
          <Link
            href={ROUTES.SETTINGS_MEMORY}
            className="inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-lg border border-interactive bg-surface-raised px-4 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised/70"
          >
            Open Memory
          </Link>
        </div>
      </section>

      {/* Privacy footnote */}
      <div className="rounded-md border border-subtle bg-surface-raised/30 p-4 text-sm text-fg-secondary">
        <p>
          <strong className="text-fg-primary">Privacy:</strong> keys are encrypted at rest, never
          logged, and stripped of whitespace before use. Cat chats save to your history; clear them
          anytime from the chat panel.
        </p>
      </div>
    </div>
  );
}
