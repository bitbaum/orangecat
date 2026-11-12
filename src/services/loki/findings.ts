/**
 * A bot files a finding into a Loki project's feedback inbox, as the person,
 * and reads where it is.
 *
 * Loki has one inbox and one machine filing contract (its
 * docs/foundation/LOOP-WALK.md, "Agent walk"). This is that contract over the
 * signed rail: the filer is the Loki account linked to the bot owner's actor,
 * so a bot can only file into projects its owner has a seat on. Filing is not
 * building: the report waits in the inbox for its owner unless the project's
 * owner opted in on Loki.
 */
import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';
import { logger } from '@/utils/logger';
import { postSignedToLoki } from './signed-post';

/** Loki's own ceilings for one filing. */
export const LOKI_FINDING_MAX_LENGTH = 2000;
export const LOKI_FINDING_AGENT_NAME_MAX = 80;

export interface LokiFindingInput {
  actorId: string;
  project: string;
  /** What was found, in words. */
  finding: string;
  /** The inbox label: the bot's own name. */
  agentName: string;
  /** The page the finding is about, if any. */
  url?: string;
  /** A retry key: the same key again returns the same report. */
  idempotencyKey?: string;
}

export type LokiFindingOutcome =
  | { ok: true; id: string; project: string; status: string; replayed: boolean; building: boolean }
  | { ok: false; reason: string; available?: string[] };

export type LokiFindingStatusOutcome =
  | {
      ok: true;
      id: string;
      state: string;
      label: string;
      reason: string | null;
      next: string | null;
    }
  | { ok: false; reason: string };

export function lokiFeedbackUrl(): string {
  return (
    process.env.LOKI_FEEDBACK_URL ||
    new URL(LOKI_ENDPOINTS.feedback, ECOSYSTEM.loki.siteUrl).toString()
  );
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function safeJson(body: string | undefined): Record<string, unknown> | null {
  if (!body) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function fileLokiFinding(input: LokiFindingInput): Promise<LokiFindingOutcome> {
  const finding = input.finding.trim();
  const project = input.project.trim();
  if (!project) {
    return { ok: false, reason: 'No project was named. Ask which Loki project this is about.' };
  }
  if (!finding) {
    return { ok: false, reason: 'There is nothing to file. Ask what was found.' };
  }
  if (finding.length > LOKI_FINDING_MAX_LENGTH) {
    return {
      ok: false,
      reason: `The finding is ${finding.length} characters; Loki takes at most ${LOKI_FINDING_MAX_LENGTH}. Nothing was filed. Shorten it.`,
    };
  }
  const url = input.url?.trim();

  const result = await postSignedToLoki(lokiFeedbackUrl(), {
    actorId: input.actorId,
    issuedAt: new Date().toISOString(),
    project,
    suggestion: finding,
    agentName: (input.agentName.trim() || 'OrangeCat bot').slice(0, LOKI_FINDING_AGENT_NAME_MAX),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(url && /^https?:\/\//i.test(url) ? { url: url.slice(0, 1000) } : {}),
  });

  const parsed = safeJson(result.body);
  if (!result.ok) {
    const available = Array.isArray(parsed?.available)
      ? (parsed.available as unknown[]).filter((v): v is string => typeof v === 'string')
      : undefined;
    logger.warn('[loki-finding] refused', { actorId: input.actorId, status: result.status });
    return {
      ok: false,
      reason: `Nothing was filed: ${str(parsed?.detail) ?? result.error}`,
      ...(available ? { available } : {}),
    };
  }
  const id = str(parsed?.id);
  if (!id) {
    // A 2xx we cannot read is not a filing we may report.
    return {
      ok: false,
      reason:
        'Loki accepted the request but its answer could not be read, so it is unknown whether the finding was filed. Say so rather than that it was filed.',
    };
  }
  return {
    ok: true,
    id,
    project: str(parsed?.project) ?? project,
    status: str(parsed?.status) ?? 'new',
    replayed: parsed?.replayed === true,
    building: parsed?.building === true,
  };
}

export async function readLokiFindingStatus(
  actorId: string,
  feedbackId: string
): Promise<LokiFindingStatusOutcome> {
  const result = await postSignedToLoki(lokiFeedbackUrl(), {
    actorId,
    issuedAt: new Date().toISOString(),
    feedbackId,
  });
  const parsed = safeJson(result.body);
  if (!result.ok) {
    return { ok: false, reason: `Loki could not be read: ${str(parsed?.detail) ?? result.error}` };
  }
  const state = str(parsed?.state);
  if (!state) {
    return {
      ok: false,
      reason: "Loki answered, but the answer could not be read. Say so, and don't invent one.",
    };
  }
  const next = parsed?.nextAction as Record<string, unknown> | undefined;
  return {
    ok: true,
    id: str(parsed?.id) ?? feedbackId,
    state,
    label: str(parsed?.label) ?? state,
    reason: str(parsed?.reason),
    next: str(next?.label) ?? str(next?.text) ?? null,
  };
}

/** The line the thread keeps for a filing: filed, not fixed. */
export function findingFiledMessage(o: Extract<LokiFindingOutcome, { ok: true }>): string {
  const head = o.replayed
    ? `That finding was already filed in ${o.project}'s feedback inbox in Loki`
    : `Filed in ${o.project}'s feedback inbox in Loki`;
  const tail = o.building
    ? 'The project builds agent reports unasked, so an agent is starting on it.'
    : 'It waits there for the project owner; nothing has been changed.';
  return `${head} (report ${o.id}). ${tail} Its status is read with loki_finding_status.`;
}

export function findingStatusMessage(o: Extract<LokiFindingStatusOutcome, { ok: true }>): string {
  return [`Report ${o.id}: **${o.label}**.`, o.reason, o.next ? `Next: ${o.next}` : null]
    .filter(Boolean)
    .join(' ');
}
