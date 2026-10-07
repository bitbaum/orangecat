'use client';

/**
 * Recording and transcription, with no opinion about what happens to the words.
 *
 * The recording itself is the fleet's — `@bitbaum/chatkit`'s useDictation, the
 * same one Loki's composer runs on. This file used to be OrangeCat's own copy,
 * and the two drifted: when a transcription failed here, the server's reason
 * ("busy, try again in a moment") was thrown away for "check your connection",
 * and the take was dropped, so trying again meant saying it all a second time
 * (2026-10-07, the AI fill panel on a create form). chatkit keeps the take and
 * the reason; this adapter keeps OrangeCat's interface (`endpoint`, the
 * `{ data: { text } }` envelope, its error names) so callers did not change.
 *
 * Server-first on purpose (`prefer: 'server'`): Whisper detects the language,
 * while a browser recogniser listens in the page's language — a Russian or
 * German sentence on an English page would come back as English nonsense.
 */

import { useCallback, useEffect, useRef } from 'react';
import { TranscriptionError, reasonFromBody } from '@bitbaum/chatkit';
import { useDictation as useChatkitDictation } from '@bitbaum/chatkit/react';

export type DictationState = 'idle' | 'recording' | 'transcribing';

export type DictationError =
  /** Mic blocked at the browser/OS level — recoverable, but only by the user. */
  | 'permission_denied'
  /** No microphone, or the browser lacks MediaRecorder. */
  | 'no_microphone'
  /** We recorded, but transcription failed. */
  | 'transcription_failed'
  /** Recorded silence — nothing to transcribe. */
  | 'no_speech';

export interface DictationErrorExtra {
  /** What the server said, when it said anything ("Dictation is busy…"). */
  detail: string | null;
  /** Send the same recording again; null when there is nothing kept. */
  retry: (() => void) | null;
}

interface UseDictationOptions {
  /** Multipart endpoint taking field "file"; returns { data: { text } }. */
  endpoint: string;
  /** BCP-47 hint (e.g. "en-US"); only the primary subtag is sent. */
  lang?: string;
  onTranscript: (text: string) => void;
  onError?: (error: DictationError, extra: DictationErrorExtra) => void;
}

/** OrangeCat's transcribe route: field "file", optional "language", answers
 *  `{ data: { text } }` or `{ error: { message } }`. */
async function postToRoute(endpoint: string, audio: Blob, lang: string | undefined) {
  const fd = new FormData();
  fd.append('file', audio, 'audio.webm');
  if (lang) {
    fd.append('language', lang);
  }
  const res = await fetch(endpoint, { method: 'POST', body: fd });
  const json = (await res.json().catch(() => null)) as { data?: { text?: unknown } } | null;
  if (!res.ok) {
    throw new TranscriptionError(reasonFromBody(json), res.status);
  }
  const text = json?.data?.text;
  return typeof text === 'string' ? text : '';
}

export function useDictation({ endpoint, lang, onTranscript, onError }: UseDictationOptions) {
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const transcribe = useCallback(
    // Only the primary subtag; without a hint Whisper detects the language.
    (audio: Blob) => postToRoute(endpoint, audio, lang?.split('-')[0]),
    [endpoint, lang]
  );

  const d = useChatkitDictation({
    onText: onTranscript,
    lang,
    prefer: 'server',
    transcribe,
  });

  // chatkit reports one problem at a time; each new one reaches the caller once.
  // retry/clearProblem are read through refs: their identity changes with the
  // status, and re-running on that would toast the same failure twice.
  const { problem, problemDetail, canRetry } = d;
  const retryRef = useRef(d.retry);
  const clearRef = useRef(d.clearProblem);
  useEffect(() => {
    retryRef.current = d.retry;
    clearRef.current = d.clearProblem;
  });
  useEffect(() => {
    if (!problem) {
      return;
    }
    const error: DictationError =
      problem === 'mic'
        ? 'permission_denied'
        : problem === 'silence'
          ? 'no_speech'
          : 'transcription_failed';
    onErrorRef.current?.(error, {
      detail: problemDetail,
      retry: canRetry ? () => void retryRef.current() : null,
    });
    // The caller now owns the message (a toast, a line); a kept take stays
    // retryable through the function it was handed.
    if (!canRetry) {
      clearRef.current();
    }
  }, [problem, problemDetail, canRetry]);

  const state: DictationState =
    d.status === 'listening' ? 'recording' : d.status === 'transcribing' ? 'transcribing' : 'idle';

  return {
    state,
    supported: d.supported,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
    start: d.start,
    stop: d.stop,
    toggle: d.toggle,
  };
}
