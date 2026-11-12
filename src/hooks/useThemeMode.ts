'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useProfileTheme } from '@/hooks/useProfileTheme';
import { DEFAULT_THEME_MODE, isThemeMode, nextThemeMode, type ThemeMode } from '@/config/theme';

/**
 * The one place theme changing is implemented.
 *
 * next-themes owns the applied class, `useProfileTheme` owns cross-device
 * persistence — this hook is the seam that keeps those two in step, so no
 * component ever calls `setTheme` without also saving the preference (a split
 * that previously had to be remembered at every call site).
 *
 * `mounted` guards hydration: the active mode is unknowable during SSR, so
 * consumers render a neutral state until it flips true.
 */
export function useThemeMode() {
  const { theme, setTheme } = useTheme();
  const { saveThemePreference } = useProfileTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const mode: ThemeMode = mounted && isThemeMode(theme) ? theme : DEFAULT_THEME_MODE;

  const setMode = useCallback(
    (next: ThemeMode) => {
      setTheme(next);
      void saveThemePreference(next);
    },
    [setTheme, saveThemePreference]
  );

  /** Advance to the next mode — the single-tap path. */
  const cycle = useCallback(() => setMode(nextThemeMode(mode)), [mode, setMode]);

  return { mode, setMode, cycle, next: nextThemeMode(mode), mounted };
}
