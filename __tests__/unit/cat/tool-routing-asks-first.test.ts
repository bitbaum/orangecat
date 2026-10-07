/**
 * The tool-routing step hears the playbook's "ask first" rule.
 *
 * Measured on production 2026-10-07 (Chromium, real model): "Throw a party on
 * Saturday" was routed on a slim prompt that knew only "a dated gathering =
 * event", which called prefill_entity_form straight away — an empty "Party on
 * Saturday" card and no questions. The full prompt's playbook said to ask
 * first, but the routing step never saw it and had already acted.
 */
import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import { HOLD_AN_EVENT, playbookRoutingNote } from '@/config/cat-playbooks';
import type { AnySupabaseClient } from '@/lib/supabase/types';

vi.mock('@/services/cat/tool-executor', () => ({ executeToolCall: vi.fn() }));

function stopResponse() {
  return {
    ok: true,
    json: async () => ({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
    }),
  } as unknown as Response;
}

async function routingSystemPrompt(message: string): Promise<string> {
  const fetchMock = vi.fn(async () => stopResponse());
  global.fetch = fetchMock as unknown as typeof fetch;
  await maybeEnrichWithSearchResults(
    {} as AnySupabaseClient,
    'user-1',
    [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: message },
    ],
    message,
    'groq',
    'test-model',
    undefined,
    undefined,
    { toolEndpoint: 'https://example.test/v1/chat/completions', toolKey: 'k' }
  );
  const call = fetchMock.mock.calls.at(0) as unknown as [string, RequestInit] | undefined;
  expect(call, 'the routing model was called').toBeDefined();
  const body = JSON.parse(String(call?.[1]?.body)) as {
    messages: { role: string; content: string }[];
  };
  return body.messages.find(m => m.role === 'system')?.content ?? '';
}

describe('routing a request that is a whole plan', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('tells the routing step to call no tool until the playbook’s questions are answered', async () => {
    const system = await routingSystemPrompt('Throw a party on Saturday');
    expect(system).toContain(`PLAYBOOK "${HOLD_AN_EVENT.heading}"`);
    expect(system).toMatch(/call NO tool/);
    for (const q of HOLD_AN_EVENT.questions) {
      expect(system).toContain(q);
    }
  });

  it('says nothing of playbooks on a turn about something else', async () => {
    const system = await routingSystemPrompt('how much should I charge for a mug');
    expect(system).not.toContain('PLAYBOOK');
  });

  it('once answered, points the plan at the action tools rather than a draft card', () => {
    const note = playbookRoutingNote('organise a meetup');
    expect(note).toContain('create_event');
    expect(note).toMatch(/not prefill_entity_form/);
  });
});
