/**
 * Memory — everything Cat knows about you.
 *
 * Split out of /settings/ai, which was rendering eleven components answering
 * three unrelated questions: how Cat is powered, what it costs, and what it
 * remembers. They belong apart for a reason stronger than tidiness.
 *
 * Billing is a SETUP surface — configured once, revisited rarely. Memory is a
 * DATA surface: you come here to read what has been written about you, correct
 * it, and delete it. That is a mailbox, not a preferences pane, and nobody
 * expects to audit what a product knows about them by scrolling past their
 * credit balance.
 *
 * It is also the question that decides whether someone trusts an AI agent with
 * their money. Giving it a name in the navigation is the cheapest honest
 * signal we can send.
 */

'use client';

import { useState } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import { useAISettings } from '@/hooks/useAISettings';
import Loading from '@/components/Loading';
import { CatCustomInstructions } from '@/components/ai/CatCustomInstructions';
import { CatMemoryManager } from '@/components/ai/CatMemoryManager';
import { CatMemoryImport } from '@/components/ai/CatMemoryImport';
import { CatProactivityToggle } from '@/components/ai/CatProactivityToggle';
import { CatInterestsManager } from '@/components/ai/CatInterestsManager';

export default function MemorySettingsPage() {
  const { user, isLoading } = useRequireAuth();
  const { preferences, isLoading: settingsLoading, updatePreferences } = useAISettings();
  const [memoryReloadKey, setMemoryReloadKey] = useState(0);

  if (isLoading) {
    return <Loading fullScreen />;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-secondary">
        Cat&apos;s memory is yours and private: review it, delete any of it, export it, or bring
        context over from another AI. Standing instructions steer how Cat behaves in every chat.
        Interests are the deliberate exception — the one part you choose to make public so other
        people can find you.
      </p>

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

      <CatProactivityToggle
        enabled={preferences?.proactive_suggestions_enabled !== false}
        isLoading={settingsLoading}
        onToggle={async enabled => {
          await updatePreferences({ proactive_suggestions_enabled: enabled });
        }}
      />

      <CatMemoryImport onImported={() => setMemoryReloadKey(k => k + 1)} />

      <CatInterestsManager />
    </div>
  );
}
