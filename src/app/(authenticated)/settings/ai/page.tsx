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

import { useState } from 'react';
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
import { CatCustomInstructions } from '@/components/ai/CatCustomInstructions';
import { CatMemoryManager } from '@/components/ai/CatMemoryManager';
import { CatMemoryImport } from '@/components/ai/CatMemoryImport';
import { CatInterestsManager } from '@/components/ai/CatInterestsManager';
import { LocalRuntimePanel } from '@/components/ai/LocalRuntimePanel';
import { AiUsageStrip } from '@/components/ai/AiUsageStrip';

export default function AISettingsPage() {
  const { user, hydrated, isLoading: authLoading } = useRequireAuth();
  const [memoryReloadKey, setMemoryReloadKey] = useState(0);

  const {
    keys,
    preferences,
    isLoading: settingsLoading,
    hasByok,
    addKey,
    deleteKey,
    setPrimaryKey,
    reorderKeys,
    updatePreferences,
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
                bill. Want {CAT_FRONTIER_MODELS_OR}? Add an OpenRouter key — one key fronts all 200+
                models.
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
      <section aria-labelledby="what-cat-knows" className="space-y-4">
        <div>
          <h2
            id="what-cat-knows"
            className="text-xs font-semibold uppercase tracking-caps text-fg-tertiary"
          >
            What Cat knows
          </h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Cat&apos;s memory is yours and private: review it, delete any of it, export it, or bring
            context over from another AI. Standing instructions steer how Cat behaves in every chat.
            Interests are the deliberate exception — the one part you choose to make public so other
            people can find you.
          </p>
        </div>

        <CatCustomInstructions
          value={preferences?.custom_instructions ?? null}
          isLoading={settingsLoading}
          onSave={async instructions => {
            await updatePreferences({ custom_instructions: instructions });
          }}
        />

        <CatMemoryManager
          reloadKey={memoryReloadKey}
          memoryEnabled={preferences?.memory_enabled !== false}
          onToggleMemory={async enabled => {
            await updatePreferences({ memory_enabled: enabled });
          }}
        />

        <CatMemoryImport onImported={() => setMemoryReloadKey(k => k + 1)} />

        <CatInterestsManager />
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
