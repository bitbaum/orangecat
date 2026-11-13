'use client';

/**
 * "May Cat bring things up on its own?"
 *
 * The switch behind `user_ai_preferences.proactive_suggestions_enabled`. It is
 * on by default, so this control exists to be found by the person it is
 * annoying — which is why the copy says plainly what Cat does with it rather
 * than selling the feature.
 */

import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { SettingToggleRow } from '@/components/ui/SettingToggleRow';

interface CatProactivityToggleProps {
  enabled: boolean;
  isLoading?: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
}

export function CatProactivityToggle({
  enabled,
  isLoading = false,
  onToggle,
}: CatProactivityToggleProps) {
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    if (saving || isLoading) {
      return;
    }
    setSaving(true);
    try {
      await onToggle(!enabled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingToggleRow
      className="rounded-md border border-subtle bg-surface-raised/30 px-4"
      leading={<Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-fg-tertiary" aria-hidden />}
      label="Let Cat bring things up"
      detail="Cat can mention something you didn’t ask about — a draft nobody can find yet, or something nobody can pay into. One at a time, at the end of a reply, and never twice. Turn this off and Cat only answers what you ask."
      checked={enabled}
      onCheckedChange={handleToggle}
      disabled={saving || isLoading}
    />
  );
}
