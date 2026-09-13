'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useStudio } from '@/hooks/useStudio';
import { STUDIO_MEDIUMS, type StudioMedium } from '@/config/studio';
import StudioComposer from './StudioComposer';
import StudioMediumTabs from './StudioMediumTabs';
import StudioNextMoves from './StudioNextMoves';
import StudioResult from './StudioResult';
import StudioReviseBar from './StudioReviseBar';

/**
 * The Studio: make something, then change it by saying what's wrong with it,
 * then finance or sell it.
 *
 * Presentational glue only — the loop itself lives in useStudio, because it is
 * two API calls that have to look like one action.
 */
export default function StudioWorkspace() {
  const [medium, setMedium] = useState<StudioMedium>(STUDIO_MEDIUMS[0]);
  const { capability, access, prompt, setPrompt, status, error, current, generate, revise } =
    useStudio(medium);

  const busy = status === 'working';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-heading tracking-display text-2xl font-bold text-fg-primary sm:text-3xl">
          Studio
        </h1>
        <p className="mt-1 text-sm text-fg-secondary sm:text-base">
          Make a film, a track, a chapter or a cover — then change it by saying what to change. When
          it&rsquo;s good, finance it or sell it.
        </p>
      </header>

      <StudioMediumTabs medium={medium} onSelect={setMedium} capability={capability} />

      <StudioComposer
        medium={medium}
        access={access}
        prompt={prompt}
        onPromptChange={setPrompt}
        onGenerate={generate}
        busy={busy}
        hasVersions={Boolean(current)}
      />

      {busy && (
        <p className="flex items-center gap-2 text-sm text-fg-secondary" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {medium === 'video'
            ? 'Rendering. Video takes a few minutes — you can leave this tab open.'
            : 'Working on it…'}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-default bg-surface-raised/30 p-4 text-sm text-fg-secondary"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-status-negative" aria-hidden />
          {error}
        </p>
      )}

      {current && (
        <>
          <StudioResult medium={medium} version={current} />
          <StudioReviseBar medium={medium} onRevise={note => void revise(note)} busy={busy} />
          <StudioNextMoves />
        </>
      )}
    </div>
  );
}
