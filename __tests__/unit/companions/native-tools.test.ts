/**
 * Each model gets its hands in the format it was trained on, and the rest of
 * the turn cannot tell the difference.
 */
import { CAT_ACTIONS } from '@/config/cat-actions';
import { modelProfile } from '@/config/model-profiles';
import { replyOnOwnKey, toolsWereRefused } from '@/services/ai/direct-reply';
import { extractProposal, stepResultMessage, withProposal } from '@/services/companions/hands';
import {
  nativeHandsSection,
  replyFromNative,
  toNativeMessages,
  toolsFor,
  WAITING_FOR_TAP,
} from '@/services/companions/native-tools';

const actions = [CAT_ACTIONS.walk_site, CAT_ACTIONS.create_product];

describe('model profiles', () => {
  it('a model that takes native tools is given them; an unknown one gets prose', () => {
    expect(modelProfile('xai', 'grok-4').nativeTools).toBe(true);
    expect(modelProfile('anthropic', 'claude-opus-5').nativeTools).toBe(true);
    expect(modelProfile('deepseek', 'deepseek-chat').nativeTools).toBe(true);
    expect(modelProfile('deepseek', 'deepseek-reasoner').nativeTools).toBe(false);
    expect(modelProfile('together', 'moonshotai/Kimi-K2-Instruct').nativeTools).toBe(true);
    expect(modelProfile('together', 'some/unknown-model').nativeTools).toBe(false);
    expect(modelProfile('made-up', '').nativeTools).toBe(false);
    // A key held on Loki with no model named here: the provider decides.
    expect(modelProfile('xai', '').nativeTools).toBe(true);
  });
});

describe('hands as native tools', () => {
  it('every hand becomes a function with its required fields', () => {
    const tools = toolsFor(actions);
    expect(tools.map(t => t.function.name)).toEqual(['walk_site', 'create_product']);
    const product = tools[1].function.parameters as {
      properties: Record<string, { type: string }>;
      required: string[];
    };
    expect(product.properties.price_btc.type).toBe('number');
    expect(product.required).toEqual(expect.arrayContaining(['title', 'price_btc']));
    for (const t of tools) {
      expect(t.function.name).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    }
  });

  it('a tool call comes back as the fence the rest of the turn reads', () => {
    const reply = replyFromNative(
      'I will walk orangecat.ch.',
      [{ id: 'c1', name: 'walk_site', arguments: '{"url":"https://orangecat.ch"}' }],
      actions
    );
    expect(extractProposal(reply)).toEqual({
      text: 'I will walk orangecat.ch.',
      proposal: { action: 'walk_site', parameters: { url: 'https://orangecat.ch' } },
    });
  });

  it('a call with no words still gives the card a sentence', () => {
    const reply = replyFromNative('', [{ id: 'c1', name: 'walk_site', arguments: '{}' }], actions);
    const { text, proposal } = extractProposal(reply);
    expect(text).toMatch(/Walk/i);
    expect(proposal?.action).toBe('walk_site');
  });

  it('a call to something not offered, or with broken arguments, is words only', () => {
    expect(
      replyFromNative('Hello.', [{ id: 'c', name: 'delete_everything', arguments: '{}' }], actions)
    ).toBe('Hello.');
    expect(
      replyFromNative('Hello.', [{ id: 'c', name: 'walk_site', arguments: '{nope' }], actions)
    ).toBe('Hello.');
    expect(
      replyFromNative('Hello.', [{ id: 'c', name: 'walk_site', arguments: '[1]' }], actions)
    ).toBe('Hello.');
    expect(replyFromNative('Hello.', undefined, actions)).toBe('Hello.');
  });

  it('history: a proposal waiting for a tap is a call with an answer', () => {
    const out = toNativeMessages([
      { role: 'system', content: 'You are a bot.' },
      { role: 'user', content: 'Check my site' },
      {
        role: 'assistant',
        content: withProposal('I will walk it.', { action: 'walk_site', parameters: { url: 'x' } }),
      },
      { role: 'user', content: 'thanks' },
    ]);
    expect(out.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'user']);
    expect(out[2]).toMatchObject({
      content: 'I will walk it.',
      tool_calls: [{ id: 'call_1', function: { name: 'walk_site', arguments: '{"url":"x"}' } }],
    });
    expect(out[3]).toEqual({ role: 'tool', tool_call_id: 'call_1', content: WAITING_FOR_TAP });
  });

  it('history: a step that ran is the tool result, not a second user line', () => {
    const result = stepResultMessage('walk_site', '3 pages, no problems.');
    const out = toNativeMessages([
      { role: 'user', content: 'Check my site' },
      {
        role: 'assistant',
        content: withProposal('Walking it.', { action: 'walk_site', parameters: {} }),
      },
      { role: 'user', content: result },
    ]);
    expect(out.map(m => m.role)).toEqual(['user', 'assistant', 'tool']);
    expect(out[2]).toEqual({ role: 'tool', tool_call_id: 'call_1', content: result });
  });

  it('history: every call has an answer, and photos pass through untouched', () => {
    const parts = [{ type: 'text', text: 'what is this' }];
    const out = toNativeMessages([
      { role: 'assistant', content: withProposal('A.', { action: 'walk_site', parameters: {} }) },
      { role: 'assistant', content: withProposal('B.', { action: 'walk_site', parameters: {} }) },
      { role: 'user', content: parts },
    ]);
    const ids = out.flatMap(m => (m.role === 'tool' ? [m.tool_call_id] : []));
    expect(ids).toEqual(['call_1', 'call_2']);
    expect(out[4].content).toBe(parts);
  });

  it('the native prompt names no fence and keeps the tap rule', () => {
    const section = nativeHandsSection(actions, ['walk_site']) ?? '';
    expect(section).not.toMatch(/```/);
    expect(section).toMatch(/taps to approve/);
    expect(section).toMatch(/run these yourself, with no tap: walk_site/);
    expect(nativeHandsSection([])).toBeUndefined();
  });

  it('a native model is sent functions; a refusal is asked again in prose', async () => {
    const sent: Array<{ tools?: unknown[]; messages: Array<{ role: string; content: unknown }> }> =
      [];
    const reply = {
      model: 'grok-4',
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      isFreeModel: false,
      usedByok: true,
    };
    const service = (refuseTools: boolean) =>
      ({
        async chatCompletion(o: {
          tools?: unknown[];
          messages: Array<{ role: string; content: unknown }>;
        }) {
          sent.push(o);
          if (o.tools && refuseTools) {
            throw new Error('400 this model does not support tools');
          }
          return o.tools
            ? {
                ...reply,
                content: '',
                toolCalls: [{ id: 'c', name: 'walk_site', arguments: '{"url":"u"}' }],
              }
            : { ...reply, content: 'In prose.' };
        },
        // eslint-disable-next-line require-yield
        async *streamChatCompletion() {
          return;
        },
      }) as never;
    const input = {
      provider: 'xai',
      model: 'grok-4',
      systemPrompt: 'PROSE PROMPT',
      messages: [{ role: 'user', content: 'Check my site' }],
      temperature: 0.7,
      native: { actions, systemPrompt: 'NATIVE PROMPT' },
      finish: async (first: never) => first,
    };
    const ok = await replyOnOwnKey({ ...input, service: service(false) });
    expect(extractProposal(ok.whole.content).proposal).toEqual({
      action: 'walk_site',
      parameters: { url: 'u' },
    });
    expect(sent[0].tools).toHaveLength(2);
    expect(sent[0].messages[0].content).toBe('NATIVE PROMPT');

    sent.length = 0;
    const fallback = await replyOnOwnKey({ ...input, service: service(true) });
    expect(fallback.whole.content).toBe('In prose.');
    expect(sent[1].tools).toBeUndefined();
    expect(sent[1].messages[0].content).toBe('PROSE PROMPT');

    sent.length = 0;
    await replyOnOwnKey({ ...input, provider: 'made-up', model: 'x', service: service(false) });
    expect(sent[0].tools).toBeUndefined();
  });

  it('only a refusal about the functions is asked again in prose', () => {
    expect(toolsWereRefused(new Error('400 tools is not supported for this model'))).toBe(true);
    expect(toolsWereRefused(new Error('Invalid schema for function walk_site'))).toBe(true);
    expect(toolsWereRefused(new Error('401 Incorrect API key'))).toBe(false);
    expect(toolsWereRefused(new Error('402 balance exhausted'))).toBe(false);
    expect(toolsWereRefused(new Error('429 Too many requests'))).toBe(false);
  });
});
