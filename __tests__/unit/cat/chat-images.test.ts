/**
 * Photos in the Cat chat: where the pixels join the prompt, what the wire
 * accepts, and that the free chain knows which of its links can see.
 */

import { linkSeesImages, usableChain } from '@bitbaum/ai-kit';
import { chatImageSchema, withImages } from '@/services/cat/chat-images';
import { servingChain } from '@/services/cat/provider-catalog';

const img = { name: 'a.jpg', dataUrl: 'data:image/jpeg;base64,/9j/4AAQ' };

describe('withImages', () => {
  it('attaches photos to the CURRENT user turn only', () => {
    const messages = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'earlier' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'What is this?' },
      { role: 'tool', content: 'tool output' },
    ];
    const out = withImages(messages, [img]);
    expect(out[1].content).toBe('earlier');
    expect(out[3].content).toEqual([
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: img.dataUrl } },
    ]);
    expect(out[4].content).toBe('tool output');
  });

  it('is the identity without photos', () => {
    const messages = [{ role: 'user', content: 'hi' }];
    expect(withImages(messages, undefined)).toBe(messages);
    expect(withImages(messages, [])).toBe(messages);
  });
});

describe('chatImageSchema', () => {
  it('takes an image data URL and nothing else', () => {
    expect(chatImageSchema.safeParse(img).success).toBe(true);
    expect(
      chatImageSchema.safeParse({ name: 'x', dataUrl: 'https://evil.example/a.jpg' }).success
    ).toBe(false);
    expect(
      chatImageSchema.safeParse({ name: 'x', dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' })
        .success
    ).toBe(false);
  });
});

describe('servingChain vision', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('marks the platform Groq link blind and Gemini sighted, from ai-kit', () => {
    process.env.GROQ_API_KEY = 'k';
    process.env.GEMINI_API_KEY = 'k';
    const links = usableChain(servingChain('What is in this photo?'));
    const verdict = (id: string) => links.filter(l => l.provider.id === id).map(linkSeesImages);
    expect(verdict('groq').every(v => v === 'no')).toBe(true);
    expect(verdict('google')).toContain('yes');
  });
});
