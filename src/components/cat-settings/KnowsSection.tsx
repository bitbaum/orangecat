'use client';

/**
 * WHAT CAT KNOWS — everything Cat carries about you, in the order you would
 * check it: what it remembers (the thing you come here to audit), the notes it
 * reads, how it should behave (standing instructions), whether it may bring
 * things up on its own, bringing memory over from another AI, and — the one
 * public part — your interests.
 *
 * Moved from /settings/memory (plus the Context tab's notes) so both pages
 * render one implementation.
 */

import { useState } from 'react';
import { useAISettings } from '@/hooks/useAISettings';
import { CatCustomInstructions } from '@/components/ai/CatCustomInstructions';
import { CatMemoryManager } from '@/components/ai/CatMemoryManager';
import { CatMemoryImport } from '@/components/ai/CatMemoryImport';
import { CatProactivityToggle } from '@/components/ai/CatProactivityToggle';
import { CatInterestsManager } from '@/components/ai/CatInterestsManager';
import { CatNotesCard } from './CatNotesCard';

export function KnowsSection() {
  const { preferences, isLoading, updatePreferences } = useAISettings();
  const [memoryReloadKey, setMemoryReloadKey] = useState(0);

  return (
    <div className="space-y-4">
      <CatMemoryManager
        reloadKey={memoryReloadKey}
        memoryEnabled={preferences?.memory_enabled !== false}
        onToggleMemory={async enabled => {
          await updatePreferences({ memory_enabled: enabled });
        }}
      />

      <CatNotesCard />

      <CatCustomInstructions
        value={preferences?.custom_instructions ?? null}
        isLoading={isLoading}
        onSave={async instructions => {
          await updatePreferences({ custom_instructions: instructions });
        }}
      />

      <CatProactivityToggle
        enabled={preferences?.proactive_suggestions_enabled !== false}
        isLoading={isLoading}
        onToggle={async enabled => {
          await updatePreferences({ proactive_suggestions_enabled: enabled });
        }}
      />

      <CatMemoryImport onImported={() => setMemoryReloadKey(k => k + 1)} />

      <CatInterestsManager />
    </div>
  );
}
