import type { DictationError } from '@/hooks/useDictation';

/**
 * What a failed dictation says — one copy for every mic in OrangeCat.
 *
 * DictationButton and VoiceCreate each kept their own, and both told the
 * person to "check your connection" for any failed transcription, including
 * the server answering that it was busy. A failed transcription now says it
 * failed, adds the server's own words when there are any, and the recording is
 * kept for a "Try again" — so the advice is never a guess about the network.
 */
export const DICTATION_ERROR_COPY: Record<DictationError, string> = {
  permission_denied:
    'Microphone blocked — allow mic access for orangecat.ch in your browser, then try again.',
  no_microphone: 'No microphone available — check your device and browser settings.',
  transcription_failed: 'Couldn’t transcribe that.',
  no_speech: 'Didn’t catch any speech — try speaking closer to the mic.',
};

export const DICTATION_RETRY_LABEL = 'Try again';

/** The sentence for a failure, with the server's reason when it gave one. */
export function dictationErrorMessage(error: DictationError, detail: string | null): string {
  const base = DICTATION_ERROR_COPY[error];
  return detail ? `${base} ${detail}` : base;
}
