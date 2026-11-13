'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { ANONYMOUS_BYLINE, needsBylineName } from '@/utils/byline';

/** Same cap as the profile's `name` (profileSchema: optionalText(100)). */
const BYLINE_MAX = 100;

export interface BylinePrompt {
  show: boolean;
  value: string;
  setValue: (value: string) => void;
  /** Saves a typed name to the profile. Resolves to an error message, or null. */
  save: () => Promise<string | null>;
}

/**
 * Asks for a byline once, before the first publish, when the writer has no
 * name the article could be signed with (only a minted `user_<hex>` handle).
 * The answer is saved as their profile name, so it signs every later article
 * and their profile too. Leaving it empty is a choice, not an error: the
 * article is signed with the neutral fallback.
 */
export function useBylinePrompt(enabled: boolean): BylinePrompt {
  const profile = useAuthStore(state => state.profile);
  const updateProfile = useAuthStore(state => state.updateProfile);
  const [value, setValue] = useState('');
  const show = enabled && !!profile && needsBylineName(profile.name, profile.username);

  async function save(): Promise<string | null> {
    const name = value.trim();
    if (!show || !name || !profile?.username) {
      return null;
    }
    // The profile route validates the whole profile, which requires the handle.
    const { error } = await updateProfile({ username: profile.username, name });
    return error ? `Your byline could not be saved: ${error}` : null;
  }

  return { show, value, setValue, save };
}

export default function BylineField({
  prompt,
  disabled,
}: {
  prompt: BylinePrompt;
  disabled: boolean;
}) {
  if (!prompt.show) {
    return null;
  }
  return (
    <div className="min-w-0">
      <label htmlFor="article-byline" className="mb-2 block text-sm font-medium text-fg-primary">
        How should your byline read?
      </label>
      <input
        id="article-byline"
        type="text"
        value={prompt.value}
        onChange={event => prompt.setValue(event.target.value)}
        maxLength={BYLINE_MAX}
        disabled={disabled}
        autoComplete="name"
        placeholder="Your name"
        aria-describedby="article-byline-hint"
        className="min-h-11 w-full rounded-md border border-default bg-surface-page px-3 text-fg-primary placeholder:text-fg-tertiary focus:border-fg-primary focus:outline-none"
      />
      <p id="article-byline-hint" className="mb-0 mt-1.5 text-xs text-fg-secondary">
        Saved as the name on your profile. Leave it empty to sign as “{ANONYMOUS_BYLINE}”.
      </p>
    </div>
  );
}
