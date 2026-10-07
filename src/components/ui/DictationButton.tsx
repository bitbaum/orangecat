'use client';

/**
 * DictationButton — a mic for any text field.
 *
 * The recording itself lives in useDictation (shared with the voice-first
 * create flow); this is only the button and the words shown when something
 * goes wrong. Server-side transcription rather than the browser Web Speech API,
 * which Brave disables by default — in-browser dictation silently failed there.
 */

import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { useDictation } from '@/hooks/useDictation';
import { DICTATION_RETRY_LABEL, dictationErrorMessage } from '@/config/dictation-copy';
import { cn } from '@/lib/utils';

interface DictationButtonProps {
  onTranscript: (text: string) => void;
  /** BCP-47 hint (e.g. "en-US"); only the primary subtag is sent to Whisper. */
  lang?: string;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function DictationButton({
  onTranscript,
  lang,
  size = 'md',
  className = '',
  disabled = false,
  ariaLabel = 'Dictate your message',
}: DictationButtonProps) {
  const { supported, isRecording, isTranscribing, toggle } = useDictation({
    endpoint: API_ROUTES.CAT.TRANSCRIBE,
    lang,
    onTranscript,
    // Each failure names its own recovery step, or it reads as a broken button.
    // A failed transcription keeps the recording: Try again resends it.
    onError: (error, { detail, retry }) => {
      const message = dictationErrorMessage(error, detail);
      if (error === 'no_speech') {
        toast.message(message);
        return;
      }
      toast.error(
        message,
        retry ? { action: { label: DICTATION_RETRY_LABEL, onClick: retry } } : {}
      );
    },
  });

  // No MediaRecorder/mic API → render nothing (the composer keeps its other controls).
  if (!supported) {
    return null;
  }

  const dim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isTranscribing}
      aria-label={ariaLabel}
      aria-pressed={isRecording}
      title={isRecording ? 'Stop & transcribe' : 'Dictate'}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        size === 'sm' ? 'p-2' : 'p-3',
        disabled || isTranscribing ? 'opacity-60' : 'hover:bg-surface-raised',
        isRecording && 'bg-status-negative-subtle',
        className
      )}
    >
      {isTranscribing ? (
        <Loader2 className={cn(dim, 'animate-spin text-fg-secondary')} />
      ) : isRecording ? (
        <Square
          className={cn(
            size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            'fill-current text-status-negative'
          )}
        />
      ) : (
        <Mic className={cn(dim, 'text-fg-secondary')} />
      )}
    </button>
  );
}

export default DictationButton;
