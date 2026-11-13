/**
 * A person's own rules for their bots (services/companions/rules.ts).
 *
 * The rules can only add a tap: only a clear ALLOW lets a step run on its
 * own, and silence asks. Reading is never checked. The prompt carries the
 * rules as written and the owner's hour.
 */
import {
  RULES_SECTION_HEADING,
  heldLine,
  knownTimeZone,
  needsReview,
  readVerdict,
  reviewQuestion,
  rulesSection,
} from '@/services/companions/rules';

describe('the verdict', () => {
  it('lets a step run only on a clear ALLOW', () => {
    expect(readVerdict('ALLOW')).toEqual({ allow: true, reason: '' });
    expect(readVerdict('allow - nothing forbids it').allow).toBe(true);
  });

  it('asks on ASK, on anything else, and on silence', () => {
    expect(readVerdict('ASK: never task orangecat without asking')).toEqual({
      allow: false,
      reason: 'never task orangecat without asking',
    });
    for (const unclear of ['Sure, go ahead!', '', null, undefined, 'I think ALLOW']) {
      expect(readVerdict(unclear).allow, String(unclear)).toBe(false);
    }
    expect(readVerdict('').reason).toMatch(/no clear answer/);
  });

  it('says in the thread that the step waits for a tap', () => {
    expect(heldLine('ask before tasks')).toBe(
      'Not run on its own: your rules ask first (ask before tasks). It waits for your tap.'
    );
  });
});

describe('what is checked', () => {
  it('never a read', () => {
    for (const id of [
      'ask_loki',
      'project_status',
      'loki_sessions',
      'loki_run_status',
      'walk_site',
    ]) {
      expect(needsReview(id, {}), id).toBe(false);
    }
  });

  it('a task, a filing, and a browser step that does something', () => {
    expect(needsReview('send_task_to_loki', {})).toBe(true);
    expect(needsReview('file_loki_finding', {})).toBe(true);
    for (const step of ['open', 'click', 'type', 'press']) {
      expect(needsReview('use_browser', { do: step }), step).toBe(true);
    }
    for (const step of ['look', 'scroll', 'back', 'close']) {
      expect(needsReview('use_browser', { do: step }), step).toBe(false);
    }
  });

  it("shows the reviewer the step, without the server's own stamp", () => {
    const q = reviewQuestion('Never open shops.', 'use_browser', {
      do: 'open',
      url: 'https://shop.test',
      bot_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(q).toContain('Never open shops.');
    expect(q).toContain('https://shop.test');
    expect(q).not.toContain('bot_id');
  });
});

describe('the prompt section', () => {
  it('carries the rules as written and says they never skip a tap', () => {
    const text = rulesSection({ rules: 'Never email anyone.', timeZone: null })!;
    expect(text.startsWith(RULES_SECTION_HEADING)).toBe(true);
    expect(text).toContain('Never email anyone.');
    expect(text).toContain('never let you skip a tap');
  });

  it("says the owner's hour in their zone", () => {
    const text = rulesSection(
      { rules: null, timeZone: 'Europe/Zurich' },
      new Date('2026-11-13T06:30:00Z')
    )!;
    expect(text).toContain('Friday');
    expect(text).toContain('07:30');
    expect(text).toContain('(Europe/Zurich)');
  });

  it('is nothing when nothing is set', () => {
    expect(rulesSection({ rules: null, timeZone: null })).toBeUndefined();
  });
});

describe('a time zone', () => {
  it('is one this runtime knows, or nothing', () => {
    expect(knownTimeZone('Europe/Zurich')).toBe('Europe/Zurich');
    expect(knownTimeZone('Mars/Olympus')).toBeNull();
    expect(knownTimeZone('')).toBeNull();
    expect(knownTimeZone(7)).toBeNull();
  });
});
