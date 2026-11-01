/**
 * A bot asks Loki a question, as the person — the first connector (ADR-0013 D6).
 *
 * Same signed rail as the task and site doors. Loki runs the turn as the Loki
 * user linked to this OrangeCat actor, read-only: an answer from the person's
 * own projects, dispatches and pages, never a dispatch, approval or spend.
 * Loki's refusals carry a sentence meant for a person (no linked account, a
 * budget that is spent), so the sentence is what comes back, not a code.
 */
import { postSignedToLoki } from './signed-post';
import { logger } from '@/utils/logger';

const ASK_URL = process.env.LOKI_ASK_URL || 'https://loki.orangecat.ch/api/orangecat/ask';

/** Loki's own ceiling for one question. */
export const LOKI_ASK_MAX_LENGTH = 4000;

export interface LokiAskInput {
  /** OrangeCat actor the question is asked for — Loki maps it to the linked account. */
  actorId: string;
  question: string;
  /** The bot's thread, so Loki keeps one session per bot. */
  threadId?: string;
  originUrl?: string;
}

export type LokiAskOutcome = { ok: true; text: string } | { ok: false; reason: string };

function safeJson(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function askLokiAsPerson(input: LokiAskInput): Promise<LokiAskOutcome> {
  const question = input.question.trim();
  if (!question) {
    return { ok: false, reason: 'There was no question to ask Loki.' };
  }
  if (question.length > LOKI_ASK_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Loki takes a question of up to ${LOKI_ASK_MAX_LENGTH} characters.`,
    };
  }

  const result = await postSignedToLoki(ASK_URL, {
    actorId: input.actorId,
    question,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(input.originUrl ? { originUrl: input.originUrl } : {}),
  });

  if (!result.ok) {
    const parsed = result.body ? safeJson(result.body) : null;
    const detail =
      typeof parsed?.detail === 'string'
        ? parsed.detail
        : typeof parsed?.error === 'string'
          ? parsed.error
          : null;
    logger.warn('[loki-ask] refused', { actorId: input.actorId, status: result.status });
    return { ok: false, reason: `Loki did not answer: ${detail ?? result.error}` };
  }

  const text = safeJson(result.body)?.text;
  if (typeof text !== 'string' || !text.trim()) {
    return {
      ok: false,
      reason:
        "Loki accepted the question but its answer could not be read. Say so, and don't invent one.",
    };
  }
  return { ok: true, text: text.trim() };
}
