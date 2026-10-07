/**
 * A prompt no shrink can fit is sent whole to the link that will answer it.
 *
 * Measured 2026-10-07 on production: "Throw a party on Saturday" in prose mode
 * lost twelve sections to the free-Groq budget — its event playbook and the
 * tappable answers among them — still did not fit, so Groq was skipped and
 * Gemini answered from the remains: an empty draft, one question, no choices.
 */
import { buildCatSystemPrompt } from '@/services/cat/system-prompt';
import { fitOrSendWhole, type CatPromptParts } from '@/services/cat/prompt-budget';
import { buildTurnDescriptor } from '@/services/cat/turn-descriptor';
import { buildReplyLanguageDirective } from '@/services/cat/reply-language';
import { getCatFewShotExamplesText } from '@/services/cat/few-shot-examples';
import { HOLD_AN_EVENT } from '@/config/cat-playbooks';

const message = 'Throw a party on Saturday';
const parts: CatPromptParts = {
  base: buildCatSystemPrompt({
    turnDescriptor: buildTurnDescriptor({ message, historyLength: 0 }),
  } as Parameters<typeof buildCatSystemPrompt>[0]),
  standingInstructions: '',
  userContext: 'PROFILE: new here',
  groundingRules: '',
  fewShot: getCatFewShotExamplesText(),
  languageDirective: buildReplyLanguageDirective(message),
  history: [],
  message,
};
const system = (r: ReturnType<typeof fitOrSendWhole>) => String(r.messages[0].content);
// Far below anything the base prompt can be shrunk to.
const IMPOSSIBLE = 500;

describe('a prompt the budget cannot hold', () => {
  it('goes whole — playbook and quick replies kept — when another link can answer', () => {
    const r = fitOrSendWhole(parts, IMPOSSIBLE, true);
    expect(r.report?.fits).toBe(false);
    expect(r.report?.sentWhole).toBe(true);
    expect(system(r)).toContain(`## ${HOLD_AN_EVENT.heading}`);
    expect(system(r)).toContain('## Tappable Answers');
  });

  it('keeps the whole prompt beside a shrunk one, for a link without the cap', () => {
    const r = fitOrSendWhole(parts, IMPOSSIBLE, false);
    expect(r.wholeSystemPrompt).toContain(`## ${HOLD_AN_EVENT.heading}`);
    expect(r.wholeSystemPrompt).toContain('## Tappable Answers');
    expect(fitOrSendWhole(parts, IMPOSSIBLE, true).wholeSystemPrompt).toBeNull();
  });

  it('is still shrunk when the capped link is the only one', () => {
    const r = fitOrSendWhole(parts, IMPOSSIBLE, false);
    expect(r.report?.sentWhole).toBeUndefined();
    expect(r.report?.sectionsDropped.length).toBeGreaterThan(0);
    expect(system(r)).not.toContain('## Tappable Answers');
  });

  it('is shrunk as before when the shrink fits', () => {
    const r = fitOrSendWhole(parts, 200_000, true);
    expect(r.report?.fits).toBe(true);
    expect(r.report?.sentWhole).toBeUndefined();
  });

  it('applies no budget when there is none', () => {
    expect(fitOrSendWhole(parts, undefined, true).report).toBeNull();
  });
});
