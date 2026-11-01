import { describe, expect, it } from 'vitest';
import { CAT_ACTIONS } from '@/config/cat-actions';
import {
  COMPANION_HANDS,
  HANDS_SECTION_HEADING,
  PROPOSAL_FENCE,
  extractProposal,
  handsActions,
  handsSection,
  proposalFromMetadata,
  withProposal,
} from '@/services/companions/hands';

/**
 * A bot's hands: it proposes, the person taps. The launch set is the
 * person's own entities and a hand-off to Loki, never money and never a
 * high-risk action; the fence is read only at the very end of a reply.
 */
describe('the launch set', () => {
  it('names real, enabled actions that are neither payments nor high risk', () => {
    expect(COMPANION_HANDS.length).toBeGreaterThanOrEqual(4);
    for (const id of COMPANION_HANDS) {
      const action = CAT_ACTIONS[id];
      expect(action, id).toBeDefined();
      expect(action.enabled, id).toBe(true);
      expect(action.category, id).not.toBe('payments');
      expect(action.riskLevel, id).not.toBe('high');
    }
    expect(handsActions().map(a => a.id)).toEqual([...COMPANION_HANDS]);
    expect(handsActions(['nope', 'create_event']).map(a => a.id)).toEqual(['create_event']);
  });
});

describe('the prompt section', () => {
  it('lists each action with its parameters and the one way to propose', () => {
    const text = handsSection(handsActions(['create_event', 'send_to_loki']))!;
    expect(text.startsWith(HANDS_SECTION_HEADING)).toBe(true);
    expect(text).toContain('- create_event — ');
    expect(text).toContain('title: string');
    expect(text).toContain('start_date: string');
    expect(text).toContain('description?: string');
    expect(text).toContain('```' + PROPOSAL_FENCE);
    expect(text).toContain('never say it is done');
    expect(text).toContain('Never propose anything in a group chat');
  });

  it('is nothing when the person has no hands', () => {
    expect(handsSection([])).toBeUndefined();
  });
});

describe('extractProposal', () => {
  const block =
    '```propose\n{"action": "create_event", "parameters": {"title": "Dentist", "start_date": "2026-11-03T09:00"}}\n```';

  it('takes the fence off the end and returns it as data', () => {
    const out = extractProposal(
      `I will set up the dentist appointment for Monday at 9.\n\n${block}`
    );
    expect(out.text).toBe('I will set up the dentist appointment for Monday at 9.');
    expect(out.proposal).toEqual({
      action: 'create_event',
      parameters: { title: 'Dentist', start_date: '2026-11-03T09:00' },
    });
  });

  it('reads a fence with trailing whitespace or a closing line after it as the end', () => {
    expect(extractProposal(`Ready.\n${block}\n\n`).proposal?.action).toBe('create_event');
  });

  it('leaves a fence quoted mid-answer, bad JSON, or no action alone', () => {
    const mid = `${block}\n\nThat is the shape, by the way.`;
    expect(extractProposal(mid)).toEqual({ text: mid, proposal: null });
    const bad = 'Sure.\n```propose\n{not json}\n```';
    expect(extractProposal(bad)).toEqual({ text: bad, proposal: null });
    const noAction = 'Sure.\n```propose\n{"parameters": {}}\n```';
    expect(extractProposal(noAction).proposal).toBeNull();
    expect(extractProposal('Plain words.')).toEqual({ text: 'Plain words.', proposal: null });
  });

  it('reads missing or odd parameters as an empty object', () => {
    expect(extractProposal('x\n```propose\n{"action": "send_to_loki"}\n```').proposal).toEqual({
      action: 'send_to_loki',
      parameters: {},
    });
    expect(
      extractProposal('x\n```propose\n{"action": "send_to_loki", "parameters": [1]}\n```').proposal
        ?.parameters
    ).toEqual({});
  });
});

describe('a proposal in the history', () => {
  const proposal = { action: 'ask_loki', parameters: { question: 'which sites are live' } };

  it('is written back the way the model wrote it, and reads back the same', () => {
    const shown = withProposal('I can ask Loki for you.  \n', proposal);
    expect(shown).toBe(
      'I can ask Loki for you.\n\n```propose\n{"action":"ask_loki","parameters":{"question":"which sites are live"}}\n```'
    );
    expect(extractProposal(shown)).toEqual({ text: 'I can ask Loki for you.', proposal });
  });

  it('comes out of stored metadata only when well-formed', () => {
    expect(proposalFromMetadata({ used_byok: false, proposal })).toEqual(proposal);
    expect(proposalFromMetadata({ proposal: { action: 'ask_loki' } })).toEqual({
      action: 'ask_loki',
      parameters: {},
    });
    expect(proposalFromMetadata({ proposal: { parameters: {} } })).toBeNull();
    expect(proposalFromMetadata({ proposal: 'ask_loki' })).toBeNull();
    expect(proposalFromMetadata(null)).toBeNull();
    expect(proposalFromMetadata({ used_byok: true })).toBeNull();
  });
});
