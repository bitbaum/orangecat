import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { normalizeLongformMarkdown, parseLongform } from '@/lib/longform/parse';

/**
 * Captioned figures must survive this repo's own formatter.
 *
 * Prettier (`singleQuote: true`) rewrites `![alt](src "caption")` to single
 * quotes on commit, and bip-kit only reads a double-quoted title — so the first
 * blog post with captions shipped its three illustrations as a stray "!" and a
 * link. These tests pin the normalization and sweep every committed post.
 */
describe('longform figure captions', () => {
  it('reads a single-quoted caption as a figure', () => {
    const { blocks } = parseLongform("![A diagram](/img/a.svg 'What it shows')");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'figure', caption: 'What it shows' });
  });

  it('still reads a double-quoted caption and a bare image', () => {
    expect(parseLongform('![A](/a.svg "Caption")').blocks[0]).toMatchObject({ type: 'figure' });
    expect(parseLongform('![A](/a.svg)').blocks[0]).toMatchObject({ type: 'image' });
  });

  it('leaves a caption holding a double quote untouched rather than breaking it', () => {
    const line = `![A](/a.svg 'He said "no"')`;
    expect(normalizeLongformMarkdown(line)).toBe(line);
  });

  it('does not touch image syntax inside a code fence', () => {
    const md = "```md\n![A](/a.svg 'Caption')\n```";
    expect(normalizeLongformMarkdown(md)).toBe(md);
  });

  it('renders every image in every committed blog post as an image, never as a link', () => {
    const dir = path.join(process.cwd(), 'content/blog');
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      const { content } = matter(fs.readFileSync(path.join(dir, file), 'utf8'));
      const { blocks } = parseLongform(content);
      const strays = blocks.filter(
        b => b.type === 'p' && 'text' in b && typeof b.text === 'string' && /^!\[/.test(b.text)
      );
      expect(strays, `${file} has an image that renders as text`).toEqual([]);
    }
  });
});
