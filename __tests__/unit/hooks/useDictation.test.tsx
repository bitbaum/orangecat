// @vitest-environment jsdom
/**
 * OrangeCat's dictation runs on @bitbaum/chatkit's (2026-10-07). A failed
 * transcription used to read "check your connection" whatever the server had
 * said, and the recording was gone. These pin the adapter: the reason reaches
 * the caller once, a kept take is retryable, and the copy never guesses.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const chatkitState = {
  supported: true,
  status: 'idle' as 'idle' | 'listening' | 'transcribing',
  problem: null as null | 'mic' | 'silence' | 'unavailable' | 'fileTooLarge',
  problemDetail: null as string | null,
  canRetry: false,
  retry: vi.fn(async () => {}),
  clearProblem: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  toggle: vi.fn(),
};

vi.mock('@bitbaum/chatkit/react', () => ({
  useDictation: () => chatkitState,
}));

import { useDictation } from '@/hooks/useDictation';
import { dictationErrorMessage } from '@/config/dictation-copy';

beforeEach(() => {
  Object.assign(chatkitState, {
    status: 'idle',
    problem: null,
    problemDetail: null,
    canRetry: false,
  });
  chatkitState.retry.mockClear();
  chatkitState.clearProblem.mockClear();
});

describe('useDictation (chatkit adapter)', () => {
  it('hands a failed transcription to the caller once, with the reason and a retry', () => {
    const onError = vi.fn();
    const { rerender } = renderHook(() =>
      useDictation({ endpoint: '/api/cat/transcribe', onTranscript: () => {}, onError })
    );
    Object.assign(chatkitState, {
      problem: 'unavailable',
      problemDetail: 'Dictation is busy right now — try again in a moment.',
      canRetry: true,
    });
    rerender();
    // A status change re-creates chatkit's retry; it must not toast twice.
    chatkitState.retry = vi.fn(async () => {});
    rerender();

    expect(onError).toHaveBeenCalledTimes(1);
    const [error, extra] = onError.mock.calls[0];
    expect(error).toBe('transcription_failed');
    expect(extra.detail).toContain('busy');
    extra.retry();
    expect(chatkitState.retry).toHaveBeenCalledTimes(1);
    expect(chatkitState.clearProblem).not.toHaveBeenCalled();
  });

  it('maps the mic and silence problems, and clears what cannot be retried', () => {
    const onError = vi.fn();
    const { rerender } = renderHook(() =>
      useDictation({ endpoint: '/x', onTranscript: () => {}, onError })
    );
    chatkitState.problem = 'mic';
    rerender();
    expect(onError).toHaveBeenLastCalledWith('permission_denied', { detail: null, retry: null });
    expect(chatkitState.clearProblem).toHaveBeenCalled();
    chatkitState.problem = 'silence';
    rerender();
    expect(onError).toHaveBeenLastCalledWith('no_speech', { detail: null, retry: null });
  });

  it("reports chatkit's status in OrangeCat's words", () => {
    chatkitState.status = 'listening';
    const { result } = renderHook(() => useDictation({ endpoint: '/x', onTranscript: () => {} }));
    expect(result.current.isRecording).toBe(true);
    expect(result.current.state).toBe('recording');
  });
});

describe('dictation copy', () => {
  it('never blames the connection, and adds the server reason when there is one', () => {
    expect(dictationErrorMessage('transcription_failed', null)).not.toMatch(/connection/i);
    expect(dictationErrorMessage('transcription_failed', 'Dictation is busy.')).toBe(
      'Couldn’t transcribe that. Dictation is busy.'
    );
  });
});
