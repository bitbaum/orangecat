/**
 * Seen live 2026-09-10: a free model opened its reply with the tool call it
 * meant to make — unfenced, unclosed — and the user read
 * `{ "type": "suggest_offers", "parameters": {}` above the answer.
 */

import { parseActionsFromResponse, stripLeakedToolCall } from '@/services/cat/response-parser';

const LEAK_UNCLOSED = `{
  "type": "suggest_offers",
  "parameters": {}
С радостью помогу превратить вашу идею в конкретные шаги на OrangeCat.

Вот несколько черновиков.`;

const LEAK_CLOSED = `{"type": "search_platform", "parameters": {"query": "bakery"}}
Here is what I found.`;

describe('stripLeakedToolCall', () => {
  it('drops an unclosed leading tool object and keeps the prose', () => {
    const out = stripLeakedToolCall(LEAK_UNCLOSED);
    expect(out.startsWith('С радостью')).toBe(true);
    expect(out).toContain('Вот несколько черновиков.');
    expect(out).not.toContain('suggest_offers');
  });

  it('drops a closed leading tool object', () => {
    expect(stripLeakedToolCall(LEAK_CLOSED)).toBe('Here is what I found.');
  });

  it('leaves ordinary replies alone, including ones that mention JSON later', () => {
    const plain = 'Sure. Send me {"type": "x"} if you like.';
    expect(stripLeakedToolCall(plain)).toBe(plain);
    expect(stripLeakedToolCall('Hello there')).toBe('Hello there');
  });

  it('is applied by the parser, so the cleaned message never carries it', () => {
    const parsed = parseActionsFromResponse(LEAK_UNCLOSED);
    expect(parsed.message.startsWith('С радостью')).toBe(true);
  });
});
