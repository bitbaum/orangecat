/**
 * Cat groundedness rules, served from the package.
 *
 * This file used to have a second job: asserting the src/services/agent-core
 * mirror was byte-identical to Loki's canonical copy. That mirror is
 * deleted — both apps import `@bitbaum/ai-kit/grounding` now, so there are no longer
 * two copies of "what counts as grounded" to diverge. (The mirror check also
 * self-skipped in CI, which clones one repo at a time; it only ever ran on a
 * laptop with both checkouts side by side. A gate that runs where nobody is
 * looking and skips where everybody is was part of why the extraction won.)
 *
 * What remains is the half that was always about Cat: grounding mode must
 * catch an invented attribute about one of the USER'S OWN records while
 * leaving general economic knowledge alone. A check that flags "Lightning"
 * gets switched off within a week, and then protects nothing.
 */
import { verifyAnswer, buildAssistantRules, NO_BASIS } from '@bitbaum/ai-kit/grounding';

describe('Cat grounding rules', () => {
  it('forbids inferring an affiliation and claiming research', () => {
    const rules = buildAssistantRules({
      subjectNoun: 'profile, entities, contacts and transactions',
    });
    expect(rules).toMatch(/not their employer/i);
    expect(rules).toMatch(/have not browsed the web/i);
    expect(rules).toContain(NO_BASIS);
  });

  it('explicitly permits general economic knowledge', () => {
    const rules = buildAssistantRules({ subjectNoun: 'entities' });
    expect(rules).toMatch(/General knowledge/);
  });
});

describe('Cat groundedness check (entity-attribution mode)', () => {
  // Stand-ins for what prepareCatChat passes: the rendered context as evidence,
  // and the user's own record names as subjects.
  const subjects = ['Elena Weber SINGA Switzerland', 'Coffee Roastery'];
  const evidence = [
    'CONTACTS: Elena Weber SINGA Switzerland (whatsapp +41774730093)\nENTITIES: Coffee Roastery (product, 0.001 BTC)',
  ];

  it('passes general payment advice that names no user record', () => {
    const r = verifyAnswer({
      answer:
        'You can accept Bitcoin over the Lightning Network. Twint is common in Switzerland, and PayPal works internationally.',
      facts: [],
      userMessage: 'how should I accept payment?',
      extraEvidence: evidence,
      mode: 'entity-attribution',
      subjects,
    });
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('catches an invented employer for one of the user’s contacts', () => {
    const r = verifyAnswer({
      answer: 'Elena Weber SINGA Switzerland is a Program Manager at Impact Hub Zurich — ask her.',
      facts: [],
      userMessage: 'who should I ask about funding?',
      extraEvidence: evidence,
      mode: 'entity-attribution',
      subjects,
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => /Impact Hub/i.test(v.text))).toBe(true);
  });

  it('passes a claim that quotes what the context actually stores', () => {
    const r = verifyAnswer({
      answer: `Elena Weber SINGA Switzerland — whatsapp +41774730093. Her role: ${NO_BASIS}`,
      facts: [],
      userMessage: 'who should I ask about funding?',
      extraEvidence: evidence,
      mode: 'entity-attribution',
      subjects,
    });
    expect(r.violations).toEqual([]);
  });
});
