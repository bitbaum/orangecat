import {
  describeAiError,
  isAiErrorCode,
  type AiErrorCode,
  type AiSurface,
} from '@/config/ai-errors';
import { ACTION_CATEGORY_KEYS } from '@/config/cat-actions';
import { ROUTES } from '@/config/routes';

/**
 * The contract: an AI failure never dead-ends.
 *
 * The regression that motivated this file is a real one a user hit — Cat
 * refused to update a product and the chat rendered
 * "Entity failed: Permission denied for entities actions": an internal
 * category slug, no cause the user could act on, and nothing to click, while
 * the page that grants the permission already existed one link away.
 *
 * So the rule is pinned here rather than trusted to each surface: every code
 * resolves to a sentence a person can read, carries a fix link whenever the
 * cure is a page we own, and always carries enough machine-readable context
 * for the bug report to route itself.
 */

const ALL_CODES: AiErrorCode[] = [
  'permission_denied',
  'daily_limit_reached',
  'spend_cap_exceeded',
  'out_of_credits',
  'provider_not_configured',
  'provider_unavailable',
  'rate_limited',
  'unparseable_response',
  'unknown_action',
  'action_disabled',
  'unknown',
];

const SURFACE: AiSurface = 'cat-action';

describe('describeAiError', () => {
  it('gives every code a sentence written for a person', () => {
    for (const code of ALL_CODES) {
      const e = describeAiError(code, { surface: SURFACE });
      expect(e.title.length).toBeGreaterThan(10);
      // A sentence, not a label: the old dead end failed exactly this check.
      expect(e.title).toMatch(/[.!]$/);
    }
  });

  it('never leaks internal vocabulary into user-facing copy', () => {
    // These are the words that made the original message useless. Provider and
    // transport nouns are banned for the same reason: they name a cause the
    // user has no way to act on.
    const banned =
      /permission denied|null|undefined|http|status code|groq|openrouter|api key|\b4\d\d\b|\b5\d\d\b/i;
    for (const code of ALL_CODES) {
      for (const category of ACTION_CATEGORY_KEYS) {
        const e = describeAiError(code, { surface: SURFACE, category });
        expect(e.title).not.toMatch(banned);
      }
    }
  });

  it('routes every fix link to a real in-app route', () => {
    const known = [
      ROUTES.DASHBOARD.CAT_PERMISSIONS,
      ROUTES.DASHBOARD.CAT,
      ROUTES.SETTINGS_AI,
      ROUTES.FEEDBACK,
    ];
    for (const code of ALL_CODES) {
      const { fix } = describeAiError(code, { surface: SURFACE, category: 'entities' });
      if (!fix) continue;
      expect(fix.label.length).toBeGreaterThan(0);
      // Split off any deep-link fragment: the base must be a route we own.
      expect(known).toContain(fix.href.split('#')[0]);
    }
  });

  it('always carries enough context for a report to route itself', () => {
    for (const code of ALL_CODES) {
      const e = describeAiError(code, {
        surface: SURFACE,
        actionId: 'update_product',
        category: 'entities',
        detail: 'Permission denied for entities actions',
      });
      expect(e.reportMessage.length).toBeGreaterThan(0);
      expect(e.diagnostics.code).toBe(code);
      expect(e.diagnostics.surface).toBe(SURFACE);
      expect(e.diagnostics.action).toBe('update_product');
      // The raw upstream string is not shown to the user, but a triager needs
      // it — dropping it would trade one dead end for another.
      expect(e.diagnostics.detail).toBe('Permission denied for entities actions');
    }
  });

  it('degrades an unrecognised code instead of rendering it', () => {
    const e = describeAiError('some_code_from_the_future', { surface: SURFACE });
    expect(e.code).toBe('unknown');
    expect(e.title).not.toContain('some_code_from_the_future');
    // Still reportable — an unknown code is precisely the case worth reporting.
    expect(e.diagnostics.code).toBe('unknown');
  });

  it('handles a missing code without throwing', () => {
    expect(describeAiError(undefined, { surface: SURFACE }).code).toBe('unknown');
  });

  describe('isAiErrorCode', () => {
    it('accepts every code the registry knows', () => {
      for (const code of ALL_CODES) {
        expect(isAiErrorCode(code)).toBe(true);
      }
    });

    it('rejects transport codes from the API error envelope', () => {
      // An API error envelope mixes vocabularies. Treating a transport code as
      // one of ours would degrade a precise validation message ("describe the
      // change you want") into a generic "something went wrong on the AI side"
      // — replacing actionable copy with a dead end.
      for (const code of ['VALIDATION_ERROR', 'RATE_LIMITED', 'BAD_REQUEST', 'INTERNAL_ERROR']) {
        expect(isAiErrorCode(code)).toBe(false);
      }
    });

    it('rejects absent values and inherited property names', () => {
      expect(isAiErrorCode(undefined)).toBe(false);
      expect(isAiErrorCode(null)).toBe(false);
      expect(isAiErrorCode('')).toBe(false);
      // `in` walks the prototype chain, so this is a real hazard, not a nicety.
      expect(isAiErrorCode('toString')).toBe(false);
      expect(isAiErrorCode('constructor')).toBe(false);
    });
  });

  describe('the regression it was built for', () => {
    const denied = describeAiError('permission_denied', {
      surface: 'cat-action',
      actionId: 'update_product',
      category: 'entities',
      detail: 'Permission denied for entities actions',
    });

    it('names the category the way the settings UI does', () => {
      expect(denied.title).toBe("Cat isn't allowed to act on my things yet.");
    });

    it('deep-links to the category card, not the top of the page', () => {
      expect(denied.fix?.href).toBe(`${ROUTES.DASHBOARD.CAT_PERMISSIONS}#category-entities`);
    });
  });

  it('deep-links every action category to its own anchor', () => {
    // Guards the pairing with the id={`category-${cat.category}`} anchors on
    // the permissions page: a new category must not silently lose its link.
    for (const category of ACTION_CATEGORY_KEYS) {
      const { fix } = describeAiError('permission_denied', { surface: SURFACE, category });
      expect(fix?.href).toBe(`${ROUTES.DASHBOARD.CAT_PERMISSIONS}#category-${category}`);
    }
  });
});
