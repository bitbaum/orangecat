'use client';

import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { getAIProvider } from '@/data/aiProviders';
import { STUDIO_MEDIA, STUDIO_PROMPT_LIMITS, type StudioMedium } from '@/config/studio';
import type { StudioMediumAccess } from '@/services/studio/client';

/**
 * The brief. One box, one button — the first thing a person sees in the Studio
 * should be somewhere to say what they want, not a rack of settings.
 */
export default function StudioComposer({
  medium,
  access,
  prompt,
  onPromptChange,
  onGenerate,
  busy,
  hasVersions,
}: {
  medium: StudioMedium;
  access: StudioMediumAccess | null;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  busy: boolean;
  hasVersions: boolean;
}) {
  const meta = STUDIO_MEDIA[medium];
  const locked = access !== null && !access.available;
  const providerNames = (access?.unlockedBy ?? [])
    .map(id => getAIProvider(id)?.name ?? id)
    .join(' or ');

  return (
    <section className="oc-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-fg-primary">{meta.name}</h2>
      <p className="mt-1 text-sm text-fg-secondary">{meta.tagline}</p>

      {locked ? (
        <div className="mt-4 rounded-lg border border-default bg-surface-raised/30 p-4">
          <p className="text-sm text-fg-secondary">
            {meta.name} runs on your own AI key — the free OrangeCat pool is text-only, and it must
            never pay for someone else&rsquo;s render. Add a{' '}
            <span className="font-medium text-fg-primary">{providerNames}</span> key to unlock it.
          </p>
          <Link
            href={ROUTES.SETTINGS_AI}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent-warm px-3 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-warm/90"
          >
            Add a key in Settings → AI
          </Link>
        </div>
      ) : (
        <>
          <label htmlFor="studio-prompt" className="sr-only">
            Describe what you want to make
          </label>
          <textarea
            id="studio-prompt"
            value={prompt}
            onChange={event => onPromptChange(event.target.value)}
            maxLength={STUDIO_PROMPT_LIMITS.max}
            rows={4}
            placeholder={meta.promptPlaceholder}
            disabled={busy}
            className="mt-4 w-full rounded-lg border border-default bg-surface-page px-3 py-2.5 text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-interactive focus:outline-none disabled:opacity-60"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-fg-tertiary">
              {hasVersions
                ? 'This starts a fresh version from scratch. To change what you have, use the box below it.'
                : 'Say what you want. You can change it afterwards by talking to it.'}
            </span>
            <Button
              variant="accent"
              onClick={onGenerate}
              disabled={busy || prompt.trim().length < STUDIO_PROMPT_LIMITS.min}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              )}
              {hasVersions ? 'Start again' : `Make it`}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
