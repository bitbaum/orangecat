/**
 * A bot's library (services/companions/library.ts): what the chat carried,
 * read from the stored lines and from nothing else.
 */
import { libraryFrom } from '@/services/companions/library';
import { fileBlockOpen, imageTag } from '@/lib/chat/attachment-tags';

const at = (n: number) => `2026-11-1${n}T10:00:00.000Z`;

describe('libraryFrom', () => {
  it('lists photos, files and links, newest first, and says who brought each', () => {
    const items = libraryFrom([
      {
        role: 'user',
        content: `${imageTag('cat.jpg', 'u1/cat/abc.jpg')}${fileBlockOpen('plan.pdf')}the plan\n</attached_file>\nlook at https://example.com/a.`,
        created_at: at(1),
      },
      {
        role: 'assistant',
        content: 'See https://orangecat.ch/discover and https://example.com/a',
        created_at: at(2),
      },
    ]);
    expect(items.map(i => [i.kind, i.name, i.from])).toEqual([
      ['link', 'orangecat.ch/discover', 'bot'],
      ['link', 'example.com/a', 'bot'],
      ['photo', 'cat.jpg', 'you'],
      ['file', 'plan.pdf', 'you'],
    ]);
    expect(items[2].ref).toBe('u1/cat/abc.jpg');
    // The same link sent twice is one entry: its latest.
    expect(items.filter(i => i.url === 'https://example.com/a')).toHaveLength(1);
  });

  it("shows a picture from the bot's browser as a picture, not a link", () => {
    const url = 'https://loki.orangecat.ch/api/orangecat/shot/0123456789abcdef0123456789abcdef';
    const [item] = libraryFrom([
      { role: 'assistant', content: `![The page](${url})`, created_at: at(3) },
    ]);
    expect(item.kind).toBe('picture');
    expect(item.url).toBe(url);
  });

  it('never reads a tag out of a bot line, and is empty for plain talk', () => {
    expect(
      libraryFrom([
        {
          role: 'assistant',
          content: imageTag('x.jpg', 'someone-else/cat/x.jpg'),
          created_at: at(1),
        },
        { role: 'user', content: 'hello there', created_at: at(2) },
      ])
    ).toEqual([]);
  });
});
