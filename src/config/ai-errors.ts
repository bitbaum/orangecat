/**
 * Single source of truth for how an AI failure is explained to the person who hit it.
 *
 * Why this file exists: OrangeCat runs several AI surfaces (Cat chat, form
 * prefill, writing, image generation) that each used to invent their own failure
 * copy at the point of failure. That produced dead ends like
 * "Entity failed: Permission denied for entities actions" — a string assembled
 * from an internal category name, with nothing to click. The user is told they
 * are blocked and left to guess both the cause and the cure, even when the page
 * that fixes it already exists.
 *
 * The rule this file enforces: a surface reports a CODE, never prose. Copy, the
 * fix link, and the bug-report payload are resolved here, so every surface
 * explains the same failure the same way and gains a fix link the moment one is
 * added — no second edit at the call site.
 *
 * Invariant: every failure ends somewhere the user can act. `fix` when we know
 * the cure; a report to Loki always (see src/lib/feedback/report.ts).
 */

import { ROUTES } from '@/config/routes';
import { ACTION_CATEGORIES, type ActionCategory } from '@/config/cat-actions';

/**
 * Why an AI action or request failed, in terms the product owns.
 *
 * Add a code when the CURE differs — not when the upstream message differs.
 * Two provider errors that a user resolves the same way are one code.
 */
export type AiErrorCode =
  | 'permission_denied'
  | 'daily_limit_reached'
  | 'spend_cap_exceeded'
  | 'out_of_credits'
  | 'provider_not_configured'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'unparseable_response'
  | 'unknown_action'
  | 'action_disabled'
  | 'invalid_parameters'
  | 'unknown';

/** Which AI surface the failure came from. Carried into the bug report so a
 *  triager never has to ask "where were you?". */
export type AiSurface = 'cat-chat' | 'cat-action' | 'form-prefill' | 'writing' | 'image-generation';

export interface AiErrorFix {
  label: string;
  href: string;
}

export interface AiErrorContext {
  surface: AiSurface;
  /** The Cat action that failed, when the failure came from one. */
  actionId?: string;
  category?: ActionCategory;
  /**
   * The raw upstream message. Deliberately never shown to the user — it is the
   * thing that produced dead ends in the first place — but it travels with the
   * bug report, where it is exactly what a triager needs.
   */
  detail?: string;
}

export interface ResolvedAiError {
  code: AiErrorCode;
  /** One sentence in the user's terms. Never a provider name or HTTP status. */
  title: string;
  /** The single action that resolves it. Absent when the user cannot. */
  fix?: AiErrorFix;
  /** Pre-filled bug report: the product describing its own failure. */
  reportMessage: string;
  /** Machine-readable context attached to the report. */
  diagnostics: Record<string, string | undefined>;
}

/**
 * Copy + cure per code.
 *
 * Entries are functions because a few titles need the context (which permission
 * category, which action) to say something specific instead of something vague.
 * A vague-but-safe title is still a dead end, just a politer one.
 */
const AI_ERRORS: Record<AiErrorCode, (ctx: AiErrorContext) => { title: string; fix?: AiErrorFix }> =
  {
    permission_denied: ctx => {
      const label = ctx.category ? ACTION_CATEGORIES[ctx.category].name.toLowerCase() : 'this';
      return {
        title: `Cat isn't allowed to handle ${label} actions yet.`,
        fix: {
          label: 'Allow it',
          // Deep-link to the exact category card, not the top of a long page:
          // "go find it yourself" is the friction this whole file removes.
          href: ctx.category
            ? ROUTES.DASHBOARD.CAT_PERMISSIONS_CATEGORY(ctx.category)
            : ROUTES.DASHBOARD.CAT_PERMISSIONS,
        },
      };
    },
    daily_limit_reached: ctx => ({
      title: 'Cat hit the daily limit you set for this action.',
      fix: {
        label: 'Adjust the limit',
        href: ctx.category
          ? ROUTES.DASHBOARD.CAT_PERMISSIONS_CATEGORY(ctx.category)
          : ROUTES.DASHBOARD.CAT_PERMISSIONS,
      },
    }),
    spend_cap_exceeded: () => ({
      title: 'This would go over the spending cap you set for Cat.',
      fix: { label: 'Review spending caps', href: ROUTES.DASHBOARD.CAT_PERMISSIONS },
    }),
    out_of_credits: () => ({
      title: 'Cat is out of credits.',
      fix: { label: 'Top up', href: ROUTES.DASHBOARD.CAT },
    }),
    provider_not_configured: () => ({
      title: 'No AI provider is connected yet.',
      fix: { label: 'Connect a provider', href: ROUTES.SETTINGS_AI },
    }),
    provider_unavailable: () => ({
      // The user cannot fix an upstream outage, so we promise nothing and make
      // reporting the obvious next step instead of offering a link that lies.
      title: 'The AI service did not respond. Trying again usually works.',
    }),
    rate_limited: () => ({
      title: 'The free AI pool is busy right now. Give it a moment and retry.',
    }),
    unparseable_response: () => ({
      title: "The AI's answer came back malformed, so nothing was changed.",
    }),
    unknown_action: () => ({
      title: 'Cat tried something this version does not know how to do.',
    }),
    action_disabled: () => ({
      title: 'That action is switched off right now.',
    }),
    invalid_parameters: () => ({
      // The model got the shape wrong, not the user. Say so plainly rather
      // than showing them a validation dump they cannot act on.
      title: 'Cat filled that in wrong, so nothing was changed.',
    }),
    unknown: () => ({
      title: 'Something went wrong on the AI side, and nothing was changed.',
    }),
  };

/**
 * Is this string one of ours?
 *
 * An API error envelope carries codes from several vocabularies — transport
 * ones like VALIDATION_ERROR and RATE_LIMITED alongside these. A surface must
 * be able to tell them apart, because feeding a transport code to
 * describeAiError would degrade a precise, actionable validation message into
 * a generic "something went wrong on the AI side".
 */
export function isAiErrorCode(value: string | undefined | null): value is AiErrorCode {
  // hasOwnProperty, not `in`: `in` walks the prototype chain, so "toString"
  // and "constructor" would pass and describeAiError would then call
  // Object.prototype.toString as if it were a copy resolver — yielding a
  // notice with no title. Codes arrive from an API envelope, i.e. off the wire.
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AI_ERRORS, value);
}

/**
 * Resolve a code into everything a surface needs to render an actionable failure.
 * Unrecognised codes degrade to `unknown` rather than leaking a raw string —
 * a wrong-but-safe sentence beats an internal identifier shown as if it were copy.
 */
export function describeAiError(
  code: AiErrorCode | string | undefined,
  ctx: AiErrorContext
): ResolvedAiError {
  const resolved: AiErrorCode = isAiErrorCode(code) ? code : 'unknown';
  const { title, fix } = AI_ERRORS[resolved](ctx);
  return {
    code: resolved,
    title,
    fix,
    reportMessage: title,
    diagnostics: {
      code: resolved,
      surface: ctx.surface,
      action: ctx.actionId,
      category: ctx.category,
      detail: ctx.detail,
    },
  };
}
