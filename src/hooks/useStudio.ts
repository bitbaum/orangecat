'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchStudioCapability,
  generateInStudio,
  pollStudioJob,
  reviseInStudio,
  type StudioMediumAccess,
} from '@/services/studio/client';
import { STUDIO_HISTORY_MAX, STUDIO_PROMPT_LIMITS, type StudioMedium } from '@/config/studio';

/** One thing the Studio made, and the prompt (or note) that produced it. */
export interface StudioVersion {
  id: number;
  prompt: string;
  /** The plain-English note that led here. Absent on the first version. */
  note?: string;
  url?: string;
  text?: string;
  title?: string;
  mimeType?: string;
}

export type StudioStatus = 'idle' | 'working' | 'ready' | 'error';

const POLL_INTERVAL_MS = 6_000;
/** Give up after ~12 minutes; a render that long has stalled, not queued. */
const POLL_MAX_ATTEMPTS = 120;

/**
 * Everything the Studio page needs, so the components stay presentational.
 *
 * The revision loop lives here because it is two calls that must look like
 * one action to the user: the note becomes a new prompt, and the new prompt
 * immediately becomes the next version.
 *
 * `initialPrompt` seeds a brief Cat wrote. It is only ever a starting value —
 * nothing runs until the person presses the button.
 */
export function useStudio(medium: StudioMedium, initialPrompt = '') {
  const [capability, setCapability] = useState<StudioMediumAccess[] | null>(null);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [status, setStatus] = useState<StudioStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<StudioVersion[]>([]);
  const nextId = useRef(1);
  const cancelled = useRef(false);

  useEffect(() => {
    fetchStudioCapability().then(setCapability);
  }, []);

  // Switching medium starts a new piece of work; carrying a half-finished
  // video's prompt into the music tab would be nothing but confusing.
  //
  // Skipped on the FIRST run, which is not a switch: the reset would wipe a
  // brief Cat just handed over before the person ever saw it.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setPrompt('');
    setVersions([]);
    setStatus('idle');
    setError(null);
    cancelled.current = true;
  }, [medium]);

  useEffect(
    () => () => {
      cancelled.current = true;
    },
    []
  );

  const pushVersion = useCallback((version: Omit<StudioVersion, 'id'>) => {
    setVersions(previous =>
      [...previous, { ...version, id: nextId.current++ }].slice(-STUDIO_HISTORY_MAX)
    );
  }, []);

  const waitForJob = useCallback(
    async (jobId: string): Promise<{ url: string; mimeType: string }> => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        if (cancelled.current) {
          throw new Error('Cancelled');
        }
        const state = await pollStudioJob(jobId, medium);
        if (state.state === 'ready') {
          return { url: state.url, mimeType: state.mimeType };
        }
        if (state.state === 'failed') {
          throw new Error(state.error);
        }
      }
      throw new Error('This is taking longer than expected. Check your provider dashboard.');
    },
    [medium]
  );

  /** Run one generation and record it as the next version. */
  const runGeneration = useCallback(
    async (text: string, note?: string) => {
      cancelled.current = false;
      setStatus('working');
      setError(null);
      try {
        const result = await generateInStudio(medium, text);
        if (result.kind === 'text') {
          pushVersion({ prompt: text, note, text: result.text, title: result.title });
        } else if (result.kind === 'file') {
          pushVersion({ prompt: text, note, url: result.url });
        } else {
          const finished = await waitForJob(result.jobId);
          pushVersion({ prompt: text, note, url: finished.url, mimeType: finished.mimeType });
        }
        if (!cancelled.current) {
          setStatus('ready');
        }
      } catch (e) {
        if (cancelled.current) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        setStatus('error');
      }
    },
    [medium, pushVersion, waitForJob]
  );

  const generate = useCallback(() => {
    const trimmed = prompt.trim();
    if (trimmed.length < STUDIO_PROMPT_LIMITS.min || status === 'working') {
      return;
    }
    void runGeneration(trimmed);
  }, [prompt, runGeneration, status]);

  /**
   * "Say what to change." For writing the note edits the text directly; for
   * everything else it rewrites the prompt and re-renders, which is the only
   * way to change a piece a generation model no longer holds.
   */
  const revise = useCallback(
    async (note: string) => {
      const current = versions[versions.length - 1];
      if (!current || status === 'working') {
        return;
      }
      cancelled.current = false;
      setStatus('working');
      setError(null);
      try {
        const revised = await reviseInStudio({
          medium,
          note,
          previousPrompt: current.prompt,
          text: current.text,
        });
        if (medium === 'writing') {
          pushVersion({ prompt: current.prompt, note, text: revised.text, title: current.title });
          setStatus('ready');
          return;
        }
        const nextPrompt = revised.prompt ?? current.prompt;
        setPrompt(nextPrompt);
        await runGeneration(nextPrompt, note);
      } catch (e) {
        if (cancelled.current) {
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not revise that. Please try again.');
        setStatus('error');
      }
    },
    [medium, pushVersion, runGeneration, status, versions]
  );

  const access = capability?.find(entry => entry.medium === medium) ?? null;

  return {
    capability,
    access,
    prompt,
    setPrompt,
    status,
    error,
    versions,
    current: versions[versions.length - 1] ?? null,
    generate,
    revise,
  };
}
