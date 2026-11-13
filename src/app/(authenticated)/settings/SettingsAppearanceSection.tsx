'use client';

/**
 * SettingsAppearanceSection — the explicit theme choice.
 *
 * The header button and the account-dropdown row both cycle in one tap, which
 * is the right cost for a preference you flip; this is the surface where you
 * pick a mode directly and read what it means. All three render from
 * THEME_MODES and write through useThemeMode, so there is one option list and
 * one save path, not three. A pick of three is one SegmentedControl row, like
 * every other pick of a few.
 */

import { Palette } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DEFAULT_THEME_MODE, THEME_MODES, getThemeModeOption } from '@/config/theme';
import { useThemeMode } from '@/hooks/useThemeMode';

export function SettingsAppearanceSection() {
  const { mode, setMode, mounted } = useThemeMode();
  const current = mounted ? mode : DEFAULT_THEME_MODE;

  return (
    <div>
      <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
        <Palette className="mr-2 h-6 w-6 text-fg-secondary" />
        Theme
      </h3>
      <p className="mb-4 max-w-prose text-fg-secondary">
        Your choice follows you to any device you sign in on.
      </p>
      <SegmentedControl
        label="Theme"
        items={THEME_MODES.map(({ value, label, icon }) => ({ value, label, icon }))}
        value={current}
        onChange={setMode}
        className="max-w-md"
      />
      <p className="mb-0 mt-2 text-sm text-fg-secondary">
        {getThemeModeOption(current).description}
      </p>
    </div>
  );
}
