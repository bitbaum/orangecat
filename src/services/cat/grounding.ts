/**
 * Cat's groundedness enforcement — check, then one repair pass.
 *
 * The check itself lives in @bitbaum/ai-kit/grounding (the packaged harness).
 * This module owns the Cat-specific policy around it: when a repair is worth
 * attempting, and — more importantly — when a repair must be REFUSED.
 *
 * Why refusing matters as much as repairing. The repair asks the model to
 * delete unsupported claims, and a model asked to delete will sometimes delete
 * more than it was asked to: the exec_action block, half the answer, or the one
 * correct sentence. A safety pass that quietly degrades good answers is worse
 * than no safety pass, because it fails in the direction nobody is watching.
 * So a repair is kept only when it clears all THREE guards below — fewer
 * violations, nothing newly invented, no dropped action — and otherwise the
 * original stands with its violations reported.
 */
import {
  verifyAnswer,
  buildRepairPrompt,
  type Violation,
  NO_BASIS,
} from '@bitbaum/ai-kit/grounding';
import { parseActionsFromResponse } from '@/services/cat/response-parser';
import type { AiService } from '@/services/ai/types';

export interface GroundingOutcome {
  /** True when the FINAL text (repaired or original) makes no unsupported claims. */
  ok: boolean;
  /** Violations remaining in the final text. */
  violations: Violation[];
  /** Set only when a repair was accepted — the text to persist and render. */
  corrected?: string;
}

/** Temperature 0 for the repair: this is a deletion task, not a creative one. */
const REPAIR_TEMPERATURE = 0;

export async function enforceGrounding(input: {
  content: string;
  message: string;
  grounding: { evidence: string[]; subjects: string[] };
  service: AiService;
  model: string;
  userId: string;
  conversationId: string | null;
}): Promise<GroundingOutcome> {
  const check = verifyAnswer({
    answer: input.content,
    facts: [],
    userMessage: input.message,
    extraEvidence: input.grounding.evidence,
    mode: 'entity-attribution',
    subjects: input.grounding.subjects,
  });
  if (check.ok) {
    return { ok: true, violations: [] };
  }

  console.warn('[cat] ungrounded claims about user data', {
    userId: input.userId,
    conversationId: input.conversationId,
    model: input.model,
    violations: check.violations.map(v => `${v.kind}:${v.text}`).slice(0, 8),
  });

  let repaired = '';
  try {
    const res = await input.service.chatCompletion({
      model: input.model,
      temperature: REPAIR_TEMPERATURE,
      messages: [
        {
          role: 'system',
          content:
            'You edit an assistant reply to remove claims its source data does not support. Return ONLY the corrected reply — no preamble, no explanation of what you changed. Preserve everything that was supported, verbatim, including any code or action blocks.',
        },
        {
          role: 'user',
          content: [
            'Source data the reply had to stay within:',
            input.grounding.evidence.join('\n').slice(0, 6000),
            '',
            `The user asked: ${input.message}`,
            '',
            `The reply:\n${input.content}`,
            '',
            buildRepairPrompt(check.violations, NO_BASIS),
          ].join('\n'),
        },
      ],
    });
    repaired = (res.content ?? '').trim();
  } catch (e) {
    // A failed repair is not a failed turn. The original still goes out, and it
    // goes out FLAGGED, which is the state the observe-only rollout already had.
    console.error('[cat] grounding repair failed:', e instanceof Error ? e.message : e);
    return { ok: false, violations: check.violations };
  }

  if (!repaired) {
    return { ok: false, violations: check.violations };
  }

  const after = verifyAnswer({
    answer: repaired,
    facts: [],
    userMessage: input.message,
    extraEvidence: input.grounding.evidence,
    mode: 'entity-attribution',
    subjects: input.grounding.subjects,
  });

  // Guard 1: the repair must actually reduce unsupported claims.
  const fewerViolations = after.violations.length < check.violations.length;

  // Guard 2: the repair must not INVENT anything new. Counting alone is not
  // enough — swapping "Program Manager at Impact Hub Zurich" for "Director at
  // Seedstars Geneva" uses fewer proper nouns and so passes a pure count test
  // while being just as fabricated. A repair is a DELETION: every flagged span
  // in the result must already have been flagged in the original.
  const originalFlagged = new Set(check.violations.map(v => v.text.toLowerCase().trim()));
  const inventedSomethingNew = after.violations.some(
    v => !originalFlagged.has(v.text.toLowerCase().trim())
  );

  // Guard 3: the repair must not drop side effects. Cat's replies carry
  // exec_action blocks; a model told to "remove unsupported claims" can take the
  // action block with them, which would silently cancel something the user
  // asked for — a failure far more expensive than the fabrication being fixed.
  const before = parseActionsFromResponse(input.content).actions.length;
  const remaining = parseActionsFromResponse(repaired).actions.length;
  const keptActions = remaining >= before;

  if (!fewerViolations || inventedSomethingNew || !keptActions) {
    console.warn('[cat] grounding repair REJECTED', {
      userId: input.userId,
      reason: inventedSomethingNew
        ? 'introduced a NEW unsupported claim'
        : !fewerViolations
          ? 'did not reduce violations'
          : 'dropped an action block',
      beforeViolations: check.violations.length,
      afterViolations: after.violations.length,
      beforeActions: before,
      afterActions: remaining,
    });
    return { ok: false, violations: check.violations };
  }

  return { ok: after.ok, violations: after.violations, corrected: repaired };
}
