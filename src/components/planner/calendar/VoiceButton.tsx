'use client';

/**
 * The calendar's microphone: tap, say "dentist Monday at nine at Chur", tap
 * again. What was said is handed back as words; the calendar reads them and
 * adds the entry at once, with Undo. Always in reach: bottom right, above the
 * phone's tab bar.
 */

import { Loader2, Mic, Square } from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { useDictation } from '@/hooks/useDictation';
import { CALENDAR_COPY } from './copy';

export function VoiceButton({ onSpoken }: { onSpoken: (words: string) => void }) {
  const d = useDictation({
    endpoint: API_ROUTES.CAT.TRANSCRIBE,
    onTranscript: text => {
      if (text.trim()) {
        onSpoken(text.trim());
      }
    },
    onError: (error, extra) => {
      const message =
        error === 'permission_denied' || error === 'no_microphone'
          ? CALENDAR_COPY.micBlocked
          : error === 'no_speech'
            ? CALENDAR_COPY.notHeard
            : (extra.detail ?? CALENDAR_COPY.notHeard);
      toast.error(message, extra.retry ? { action: { label: 'Retry', onClick: extra.retry } } : {});
    },
  });

  if (!d.supported) {
    return null;
  }
  const busy = d.isTranscribing;
  const status = d.isRecording ? CALENDAR_COPY.listening : busy ? CALENDAR_COPY.transcribing : null;

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-40 flex items-center gap-3 lg:bottom-8 lg:right-8">
      {status && (
        <span
          role="status"
          className="pointer-events-auto rounded-full bg-surface-overlay px-4 py-2 text-sm text-fg-primary shadow-lg"
        >
          {status}
        </span>
      )}
      <button
        type="button"
        aria-label={d.isRecording ? CALENDAR_COPY.listening : CALENDAR_COPY.speak}
        aria-pressed={d.isRecording}
        disabled={busy}
        onClick={() => d.toggle()}
        className={`pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full bg-fg-primary text-fg-inverted shadow-xl transition-transform active:scale-95 ${
          d.isRecording ? 'scale-110' : ''
        }`}
      >
        {d.isRecording && (
          <span
            className="absolute inset-0 animate-ping rounded-full bg-fg-primary opacity-30"
            aria-hidden="true"
          />
        )}
        {busy ? (
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
        ) : d.isRecording ? (
          <Square className="h-6 w-6 fill-current" aria-hidden="true" />
        ) : (
          <Mic className="h-7 w-7" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
