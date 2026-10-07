/**
 * Cat groundedness ENFORCEMENT policy.
 *
 * The check itself is covered in agent-core-grounding.test.ts. What matters
 * here is the policy around it, and specifically the three cases where a repair
 * must be REFUSED — because a safety pass that quietly degrades good answers
 * fails in the direction nobody is watching, and would be worse than the
 * observe-only behaviour it replaces.
 */
import { enforceGrounding } from '@/services/cat/grounding';
import type { AiService } from '@/services/ai/types';

const SUBJECTS = ['Elena Weber SINGA Switzerland'];
const EVIDENCE = ['CONTACTS: Elena Weber SINGA Switzerland (whatsapp +41774730093)'];

/** An AiService whose chatCompletion returns a scripted reply. */
function stubService(reply: string | Error): AiService {
  return {
    streamChatCompletion: () => {
      throw new Error('not used');
    },
    chatCompletion: async () => {
      if (reply instanceof Error) throw reply;
      return {
        content: reply,
        model: 'stub',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        isFreeModel: true,
        usedByok: false,
      };
    },
  };
}

const base = {
  message: 'who should I ask about funding?',
  grounding: { evidence: EVIDENCE, subjects: SUBJECTS },
  model: 'stub',
  userId: 'u1',
  conversationId: 'c1',
};

const FABRICATION = 'Elena Weber SINGA Switzerland is a Program Manager at Impact Hub Zurich.';
const CLEAN = 'Elena Weber SINGA Switzerland — whatsapp +41774730093. Her role is not recorded.';

describe('enforceGrounding', () => {
  it('leaves a clean reply untouched and does not call the model', async () => {
    let called = false;
    const service = stubService('should never be used');
    const spied: AiService = {
      ...service,
      chatCompletion: async (...args) => {
        called = true;
        return service.chatCompletion(...args);
      },
    };
    const r = await enforceGrounding({ ...base, content: CLEAN, service: spied });
    expect(r.ok).toBe(true);
    expect(r.corrected).toBeUndefined();
    expect(called).toBe(false); // a clean turn must cost nothing extra
  });

  it('accepts a repair that removes the fabrication', async () => {
    const r = await enforceGrounding({
      ...base,
      content: FABRICATION,
      service: stubService(CLEAN),
    });
    expect(r.corrected).toBe(CLEAN);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('REJECTS a repair that swaps one fabrication for another', async () => {
    // Counting violations alone is not enough: this rewrite uses FEWER proper
    // nouns than the original and would pass a pure count test while being just
    // as invented. A repair is a deletion — nothing new may appear.
    const worse = 'Elena Weber SINGA Switzerland is Director at Seedstars Geneva.';
    const r = await enforceGrounding({
      ...base,
      content: FABRICATION,
      service: stubService(worse),
    });
    expect(r.corrected).toBeUndefined(); // original stands, flagged
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it('REJECTS a repair that drops an exec_action block', async () => {
    // The expensive failure mode: told to "remove unsupported claims", a model
    // takes the action block with them and silently cancels what the user asked
    // for. Losing a side effect is worse than the fabrication being fixed.
    const withAction = `${FABRICATION}\n\`\`\`exec_action\n{"type":"exec_action","actionId":"send_message","parameters":{"to":"Elena"}}\n\`\`\``;
    const strippedAction = 'Elena Weber SINGA Switzerland — whatsapp +41774730093.';
    const r = await enforceGrounding({
      ...base,
      content: withAction,
      service: stubService(strippedAction),
    });
    expect(r.corrected).toBeUndefined();
    expect(r.ok).toBe(false);
  });

  it('falls back to the flagged original when the repair call throws', async () => {
    const r = await enforceGrounding({
      ...base,
      content: FABRICATION,
      service: stubService(new Error('provider down')),
    });
    expect(r.corrected).toBeUndefined();
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0); // reported, not swallowed
  });

  it('falls back to the flagged original when the repair returns empty', async () => {
    const r = await enforceGrounding({
      ...base,
      content: FABRICATION,
      service: stubService('   '),
    });
    expect(r.corrected).toBeUndefined();
    expect(r.ok).toBe(false);
  });

  it('does not fire on general economic advice naming no user record', async () => {
    const general =
      'You can accept Bitcoin over the Lightning Network, or use Twint inside Switzerland.';
    const r = await enforceGrounding({ ...base, content: general, service: stubService('unused') });
    expect(r.ok).toBe(true);
    expect(r.corrected).toBeUndefined();
  });
});
