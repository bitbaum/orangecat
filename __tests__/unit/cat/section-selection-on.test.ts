import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildTurnDescriptor, isNoSpecificRequest } from '@/services/cat/turn-descriptor';
import { CORE_SECTIONS } from '@/config/cat-prompt-sections';
import { CAT_ACTIONS } from '@/config/cat-actions';

/**
 * Section selection, with the flag ON.
 *
 * Every earlier test of selection ran with the flag off, or called the
 * selector directly. Nothing proved the assembled prompt under the flag, and
 * nothing at all produced a turn descriptor — so the flag was a double gate
 * that changed nothing when set. Two things are pinned here:
 *
 *   1. the producer (turn-descriptor.ts) emits the markers the section
 *      config already expects, from facts the caller has;
 *   2. selection composes with actionsVia in every combination without
 *      throwing. The first version threw on flag-on + 'none' + a greeting,
 *      because it selected first and then demanded a heading selection had
 *      already removed. That exact turn is the first case below.
 */

describe('buildTurnDescriptor', () => {
  it('marks the first message from the conversation, not from wording', () => {
    expect(buildTurnDescriptor({ message: 'sell my bike', historyLength: 0 })).toContain(
      'first-message'
    );
    expect(buildTurnDescriptor({ message: 'sell my bike', historyLength: 3 })).not.toContain(
      'first-message'
    );
  });

  it('marks a greeting as no specific request, and a request as one', () => {
    for (const m of ['hi', 'Hello there!', 'hey cat', '', 'привет']) {
      expect(isNoSpecificRequest(m), m).toBe(true);
    }
    for (const m of ['hi, sell my bike', 'publish my project', 'how much should I charge?']) {
      expect(isNoSpecificRequest(m), m).toBe(false);
    }
    expect(buildTurnDescriptor({ message: 'hi', historyLength: 2 })).toContain(
      'no-specific-request'
    );
  });

  it('carries the page and entity so "make it cheaper" on a product page finds the right sections', () => {
    const d = buildTurnDescriptor({
      message: 'make it cheaper',
      historyLength: 1,
      currentPath: '/dashboard/store/abc',
      currentEntity: { type: 'product', ref: 'abc' },
    });
    expect(d).toContain('my product');
    expect(d).toContain('/dashboard/store/abc');
    expect(d.startsWith('make it cheaper')).toBe(true);
  });
});

describe('selection with the flag on, composed with actionsVia', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadWithFlagOn() {
    vi.stubEnv('CAT_PROMPT_SECTION_SELECTION', '1');
    vi.resetModules();
    return import('@/services/cat/system-prompt');
  }

  const greeting = buildTurnDescriptor({ message: 'hi', historyLength: 0 });
  const pricing = buildTurnDescriptor({ message: 'how much should I charge?', historyLength: 4 });

  it('does not throw on the turn that used to throw: none + a greeting', async () => {
    const { buildCatSystemPrompt, SECTION_SELECTION_ENABLED } = await loadWithFlagOn();
    expect(SECTION_SELECTION_ENABLED).toBe(true);
    expect(() => buildCatSystemPrompt({ actionsVia: 'none', turnDescriptor: greeting })).not.toThrow();
  });

  it.each(['prose', 'tools', 'none'] as const)(
    'keeps every core section and every action on the %s path for a greeting',
    async actionsVia => {
      const { buildCatSystemPrompt, ACTION_PROSE_SECTION_HEADINGS } = await loadWithFlagOn();
      const out = buildCatSystemPrompt({ actionsVia, turnDescriptor: greeting });
      const dropped = new Set<string>(actionsVia === 'prose' ? [] : ACTION_PROSE_SECTION_HEADINGS);
      for (const heading of CORE_SECTIONS) {
        if (dropped.has(heading)) {
          continue; // removed by capability, on purpose, before selection
        }
        expect(out, heading).toContain(`## ${heading}`);
      }
      if (actionsVia === 'prose') {
        for (const a of Object.values(CAT_ACTIONS).filter(a => a.enabled)) {
          expect(out.includes(`**${a.id}(`) || out.includes(`"actionId": "${a.id}"`), a.id).toBe(true);
        }
      }
    }
  );

  it('actually drops a situational section a greeting does not need, and keeps it when asked for', async () => {
    const { buildCatSystemPrompt } = await loadWithFlagOn();
    const unselected = buildCatSystemPrompt({ actionsVia: 'tools' });
    const onGreeting = buildCatSystemPrompt({ actionsVia: 'tools', turnDescriptor: greeting });
    const onPricing = buildCatSystemPrompt({ actionsVia: 'tools', turnDescriptor: pricing });
    expect(onGreeting).not.toContain('## Pricing Guidance');
    expect(onPricing).toContain('## Pricing Guidance');
    expect(onGreeting).toContain('## Opening a Conversation');
    expect(onPricing).not.toContain('## Opening a Conversation');
    // Measured 2026-09-11 on the tools path: unselected 32,019; a first-message
    // greeting 23,097 (it pulls three orientation sections, so it is the
    // LONGER of the two); a pricing question 18,824. The claim is that each
    // turn is materially smaller than sending everything — not that one kind
    // of turn is smaller than another.
    expect(unselected.length - onGreeting.length).toBeGreaterThan(5_000);
    expect(unselected.length - onPricing.length).toBeGreaterThan(5_000);
  });

  it('puts the cannot-act notice last even when selection ran', async () => {
    const { buildCatSystemPrompt } = await loadWithFlagOn();
    const out = buildCatSystemPrompt({ actionsVia: 'none', turnDescriptor: pricing });
    const notice = out.lastIndexOf('## You Cannot Execute Actions On This Turn');
    expect(notice).toBeGreaterThan(out.lastIndexOf('## Critical Rules'));
    expect(out).not.toContain('## Managing Existing Entities');
  });

  it('is a no-op without a descriptor, flag or not', async () => {
    const { buildCatSystemPrompt } = await loadWithFlagOn();
    expect(buildCatSystemPrompt({ actionsVia: 'tools' })).toBe(
      buildCatSystemPrompt({ actionsVia: 'tools', turnDescriptor: undefined })
    );
    expect(buildCatSystemPrompt({ actionsVia: 'tools' })).toContain('## Pricing Guidance');
  });
});
