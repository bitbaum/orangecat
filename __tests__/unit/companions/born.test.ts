import { describe, expect, it } from 'vitest';
import {
  isStarterDefinition,
  jobDefinition,
  jobLine,
  starterDefinition,
} from '@/config/companions';
import { isJobAnswer } from '@/services/companions/born';

describe('a born companion takes the job it is given', () => {
  it('recognises its own born-with definition and nothing else', () => {
    expect(isStarterDefinition(starterDefinition('Walker'))).toBe(true);
    expect(isStarterDefinition(jobDefinition('Walker', 'help me decide'))).toBe(false);
    expect(isStarterDefinition(null)).toBe(false);
  });

  it('turns the first answer into a job line that fits a row', () => {
    expect(jobLine('B')).toBe('organisation & everyday life');
    expect(
      jobLine(
        'E. Something else. You are Skeptic: find the two biggest flaws in any plan. Be brief.'
      )
    ).toBe('find the two biggest flaws in any plan');
    expect(jobLine('Help me think clearly about hard decisions. Ask one question at a time.')).toBe(
      'help me think clearly about hard decisions'
    );
    expect(jobLine("You're my coach — keep me honest about the gym.")).toBe(
      'keep me honest about the gym'
    );
    expect(jobLine('x'.repeat(140)).length).toBeLessThanOrEqual(60);
  });

  it("keeps the person's words in the definition and forbids asking again", () => {
    const d = jobDefinition('Skeptic', 'Find flaws in plans.');
    expect(d).toContain('Your job, in their own words: Find flaws in plans.');
    expect(d).toContain('Never ask again');
  });

  it("adopts only on the owner's first message to a companion still waiting", () => {
    const born = { system_prompt: starterDefinition('Walker'), user_id: 'u1' };
    expect(isJobAnswer(born, 'u1', [])).toBe(true);
    expect(isJobAnswer(born, 'u1', [{ role: 'user' }, { role: 'assistant' }])).toBe(false);
    expect(isJobAnswer(born, 'u2', [])).toBe(false);
    expect(isJobAnswer({ system_prompt: 'You are a poet.', user_id: 'u1' }, 'u1', [])).toBe(false);
  });
});
