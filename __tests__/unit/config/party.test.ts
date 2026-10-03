/**
 * "Throw a party" is one click, and the click has to land on a Cat that knows
 * what to do with it.
 *
 * Three ways it could quietly break, each pinned here:
 *   - the playbook names an action the Cat no longer has (a promised step that
 *     cannot be taken);
 *   - the request the button sends stops matching the trigger that loads the
 *     playbook (the button arrives at a Cat with no idea how to throw a party);
 *   - the create menu loses the entry, or splits the "People" group around it.
 */

import { CAT_ACTIONS } from '@/config/cat-actions';
import { ACTION_HANDLERS } from '@/services/cat/handlers';
import { selectPromptSections } from '@/config/cat-prompt-sections';
import { CREATE_OPTIONS } from '@/config/create-options';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { solonProposalHandoff } from '@/config/neighbour-capabilities';
import { BASE_SYSTEM_PROMPT_FOR_TEST } from '@/services/cat/system-prompt';
import {
  PARTY,
  PARTY_QUESTIONS,
  PARTY_SECTION_HEADING,
  PARTY_STEPS,
  PARTY_TRIGGER,
  partyCatHref,
  partyPlaybook,
} from '@/config/party';

describe('the party playbook only promises what the Cat can do', () => {
  it.each(PARTY_STEPS.map(s => [s.action] as const))(
    '%s is an enabled Cat action with a handler',
    action => {
      expect(CAT_ACTIONS[action]?.enabled).toBe(true);
      expect(ACTION_HANDLERS[action]).toBeDefined();
    }
  );

  it('keeps governance and Loki conditional — most parties need neither', () => {
    const byAction = Object.fromEntries(PARTY_STEPS.map(s => [s.action, s]));
    expect(byAction.propose_to_group?.conditional).toBe(true);
    expect(byAction.build_site?.conditional).toBe(true);
    expect(byAction.create_event?.conditional).toBeFalsy();
  });

  it('asks every question in the brief, and the brief carries the playbook verbatim', () => {
    const playbook = partyPlaybook();
    for (const q of PARTY_QUESTIONS) {
      expect(playbook).toContain(q);
    }
    expect(playbook.startsWith(`## ${PARTY_SECTION_HEADING}\n`)).toBe(true);
    expect(BASE_SYSTEM_PROMPT_FOR_TEST).toContain(playbook);
  });
});

describe('one click arrives with the playbook', () => {
  it('opens the Cat with the request already in the door parameter', () => {
    const url = new URL(partyCatHref(), 'https://example.test');
    expect(url.searchParams.get(CAT_QUERY_PARAM)).toBe(PARTY.request);
  });

  it('the request the button sends loads the playbook section', () => {
    expect(selectPromptSections(PARTY.request).has(PARTY_SECTION_HEADING)).toBe(true);
  });

  it.each([
    'Help me plan my birthday',
    'We want a housewarming next Friday',
    'Organise a Feier für das Team',
    'Хочу устроить вечеринку',
  ])('also loads it when someone just says so: %s', sentence => {
    expect(PARTY_TRIGGER.test(sentence.toLowerCase())).toBe(true);
  });

  it('stays out of a turn about pricing a mug', () => {
    expect(
      selectPromptSections('how much should i charge for a mug').has(PARTY_SECTION_HEADING)
    ).toBe(false);
  });
});

describe('the create menu offers it', () => {
  it('sits directly above Event, inside the same group', () => {
    const i = CREATE_OPTIONS.findIndex(o => o.href === partyCatHref());
    expect(i).toBeGreaterThan(0);
    expect(CREATE_OPTIONS[i]?.name).toBe(PARTY.label);
    const next = CREATE_OPTIONS[i + 1];
    expect(next?.href).toBe(ENTITY_REGISTRY.event.createPath);
    expect(CREATE_OPTIONS[i]?.category).toBe(next?.category);
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
