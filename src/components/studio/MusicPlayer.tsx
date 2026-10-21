'use client';
import { useEffect, useState } from 'react';
import type { CreativeDraft } from '@/domain/creative/brief';
import { renderMusicWav } from '@/domain/creative/music';
export function MusicPlayer({ draft }: { draft: CreativeDraft }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!draft.score) {
      return;
    }
    const next = URL.createObjectURL(
      new Blob([renderMusicWav(draft.score)], { type: 'audio/wav' })
    );
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [draft]);
  return (
    <div className="mt-5 space-y-3">
      <p className="text-sm text-fg-secondary">
        Original instrumental sketch · {draft.score?.bpm} BPM · synthesized on this device · no
        vocals
      </p>
      {url && (
        <>
          <audio
            className="w-full"
            controls
            preload="metadata"
            src={url}
            aria-label={`${draft.title} instrumental sketch`}
          />
          <a
            className="inline-flex min-h-11 items-center underline underline-offset-4"
            href={url}
            download="studio-sketch.wav"
          >
            Download WAV
          </a>
        </>
      )}
    </div>
  );
}
