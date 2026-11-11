/**
 * Where dictation goes, and in what order.
 *
 * A chain for @bitbaum/ai-kit's `transcribe`, which is the fleet's one
 * speech-to-text implementation. The route used to be a hand-rolled fetch at
 * one Groq model with no fallback, so a rotted or briefly overloaded model
 * meant dictation was simply broken.
 *
 * Not the chat chain: those models answer questions, these transcribe audio.
 * Two models at one vendor is the extent of what this deployment has a key
 * for; a second vendor is a change to this file and nothing else.
 */
import type { Link } from '@bitbaum/ai-kit';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';

const GROQ_SPEECH = {
  id: 'groq',
  baseUrl: PROVIDER_BASE_URLS.groq,
  keyEnv: 'GROQ_API_KEY',
  models: ['whisper-large-v3-turbo', 'whisper-large-v3'],
  // Transcription is billed by audio seconds, so it draws on no token pool.
  dailyTokens: 0,
} as const;

/** The links to try, in order: the fast model first. */
export function speechChain(): Link[] {
  return GROQ_SPEECH.models.map(model => ({
    provider: { ...GROQ_SPEECH, models: [...GROQ_SPEECH.models] },
    model,
  }));
}

/** Whether this deployment can transcribe at all. */
export function speechConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env[GROQ_SPEECH.keyEnv]?.trim());
}
