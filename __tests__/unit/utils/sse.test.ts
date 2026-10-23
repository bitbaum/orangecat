import { readEventStream } from '@/lib/sse';
import { ReadableStream as NodeReadableStream } from 'stream/web';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';

// Polyfill encoders/decoders for Jest/node environment
// @ts-ignore
global.TextDecoder = NodeTextDecoder as unknown as typeof global.TextDecoder;
// @ts-ignore
global.TextEncoder = NodeTextEncoder as unknown as typeof global.TextEncoder;

function makeStream(chunks: string[]): NodeReadableStream<Uint8Array> {
  let i = 0;
  return new NodeReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

describe('readEventStream', () => {
  test('parses SSE data lines with JSON payloads', async () => {
    const received: any[] = [];
    const body = makeStream([
      'data: {"content":"Hello"}\n\n',
      'data: {"content":" World"}\n\n',
      'data: {"done":true}\n\n',
    ]);
    await readEventStream(body, msg => received.push(msg));
    expect(received).toEqual([{ content: 'Hello' }, { content: ' World' }, { done: true }]);
  });

  test('parses JSONL lines with OpenAI-compatible deltas', async () => {
    const received: any[] = [];
    const body = makeStream([
      '{"choices":[{"delta":{"content":"Hi"}}]}\n',
      '{"choices":[{"delta":{"content":" there"}}]}\n',
      '[DONE]\n',
    ]);
    await readEventStream(body, msg => received.push(msg));
    expect(received[0]?.choices?.[0]?.delta?.content).toBe('Hi');
    expect(received[1]?.choices?.[0]?.delta?.content).toBe(' there');
    expect(received[2]).toBe('[DONE]');
  });
});
