import { normalizeMarkdown } from 'bip-kit';
import { parseLongform } from '@/lib/longform/parse';
import { getBlogPost, getBlogPostSlugs } from '@/lib/blog';

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
    expect(normalizeMarkdown(line)).toBe(line);
  });

  it('does not touch image syntax inside a code fence', () => {
    const md = "```md\n![A](/a.svg 'Caption')\n```";
    expect(normalizeMarkdown(md)).toBe(md);
  });

  it('renders every image in every committed blog post as an image, never as a link', () => {
    for (const slug of getBlogPostSlugs()) {
      const strays = getBlogPost(slug)!.blocks.filter(
        b => b.type === 'p' && 'text' in b && typeof b.text === 'string' && /^!\[/.test(b.text)
      );
      expect(strays, `${slug} has an image that renders as text`).toEqual([]);
    }
  });
});
