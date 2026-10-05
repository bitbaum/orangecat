/**
 * A playbook is a promise the Cat makes in a conversation, so it may only
 * promise what the Cat can do.
 *
 * Three ways one could quietly break, each pinned here for EVERY playbook:
 *   - a step names an action the Cat no longer has, or that has no handler;
 *   - the sentences a person would say stop loading the playbook, so the Cat
 *     meets "throw a party" with no idea how to throw one;
 *   - the brief stops carrying the section the config describes.
 */

import { CAT_ACTIONS } from '@/config/cat-actions';
import { ACTION_HANDLERS } from '@/services/cat/handlers';
import { selectPromptSections } from '@/config/cat-prompt-sections';
import { DROPPABLE_SECTIONS_IN_ORDER } from '@/services/cat/prompt-budget';
import { solonProposalHandoff } from '@/config/neighbour-capabilities';
import {
  ACTION_INSTRUCTION_SECTION_HEADINGS,
  BASE_SYSTEM_PROMPT_FOR_TEST,
} from '@/services/cat/system-prompt';
import { MAX_ACTION_STEPS } from '@/services/cat/action-loop';
import { CAT_PLAYBOOKS, HOLD_AN_EVENT, playbookSection } from '@/config/cat-playbooks';

const STEPS = CAT_PLAYBOOKS.flatMap(p => p.steps.map(s => [p.id, s.action] as const));
const EXAMPLES = CAT_PLAYBOOKS.flatMap(p => p.examples.map(e => [p.id, e, p.heading] as const));

describe('every playbook only promises what the Cat can do', () => {
  it.each(STEPS)('%s → %s is an enabled Cat action with a handler', (_id, action) => {
    expect(CAT_ACTIONS[action]?.enabled).toBe(true);
    expect(ACTION_HANDLERS[action]).toBeDefined();
  });

  it('has unique ids and headings', () => {
    expect(new Set(CAT_PLAYBOOKS.map(p => p.id)).size).toBe(CAT_PLAYBOOKS.length);
    expect(new Set(CAT_PLAYBOOKS.map(p => p.heading)).size).toBe(CAT_PLAYBOOKS.length);
  });

  it('leaves room in one reply for its unconditional steps', () => {
    for (const p of CAT_PLAYBOOKS) {
      expect(p.steps.filter(s => !s.conditional).length).toBeLessThanOrEqual(MAX_ACTION_STEPS);
    }
  });
});

describe('the brief carries each playbook, and only when it is wanted', () => {
  it.each(CAT_PLAYBOOKS.map(p => [p.id, p] as const))(
    '%s is in the brief verbatim, asking every question',
    (_id, p) => {
      const section = playbookSection(p);
      for (const q of p.questions) {
        expect(section).toContain(q);
      }
      expect(BASE_SYSTEM_PROMPT_FOR_TEST).toContain(section);
    }
  );

  it.each(EXAMPLES)('%s loads on: %s', (_id, sentence, heading) => {
    expect(selectPromptSections(sentence).has(heading)).toBe(true);
  });

  it('stays out of a turn about pricing a mug', () => {
    const chosen = selectPromptSections('how much should i charge for a mug');
    for (const p of CAT_PLAYBOOKS) {
      expect(chosen.has(p.heading)).toBe(false);
    }
  });

  it('is droppable under budget pressure, and removed where nothing can act', () => {
    for (const p of CAT_PLAYBOOKS) {
      expect(DROPPABLE_SECTIONS_IN_ORDER).toContain(p.heading);
      expect(ACTION_INSTRUCTION_SECTION_HEADINGS).toContain(p.heading);
    }
  });
});

describe('holding an event', () => {
  it('keeps governance, Loki, bookings and promotion conditional — a party needs none', () => {
    const byAction = Object.fromEntries(HOLD_AN_EVENT.steps.map(s => [s.action, s]));
    for (const action of ['propose_to_group', 'build_site', 'book_service', 'draft_promotion']) {
      expect(byAction[action]?.conditional, action).toBe(true);
    }
    expect(byAction.create_event?.conditional).toBeFalsy();
  });

  it('sizes itself from a party to a conference with one playbook', () => {
    for (const s of ['throw a party for my 30th', 'organise a conference', 'a meetup in zürich']) {
      expect(HOLD_AN_EVENT.trigger.test(s)).toBe(true);
    }
  });
});

describe('a group decision handed to Solon', () => {
  it('is a prefilled proposal form, never a filed proposal', () => {
    const url = new URL(
      solonProposalHandoff({
        title: 'Summer party budget',
        body: 'Use 0.002 BTC of the shared purse',
        category: 'TREASURY_SPEND',
        source: '/groups/witikon',
      })
    );
    expect(url.pathname).toBe('/propose');
    expect(url.searchParams.get('from')).toBe('orangecat');
    expect(url.searchParams.get('title')).toBe('Summer party budget');
    expect(url.searchParams.get('category')).toBe('TREASURY_SPEND');
    expect(url.searchParams.get('source')).toBe('/groups/witikon');
  });
});
