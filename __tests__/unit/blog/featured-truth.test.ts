/**
 * The blog's "Featured Article" (orangecat-2025-complete-platform) presented
 * planned treasury and governance features as live: 3-of-5 multisig,
 * quadratic voting, a 24-hour time-lock, payroll, transactions posting to the
 * timeline on their own. None was built (orangecat.ch, 2026-11-12). The post
 * keeps its words; it stops being featured and opens with a dated note.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { getBlogPost } from '@/lib/blog';

const source = (slug: string) =>
  readFileSync(path.join(process.cwd(), 'content/blog', `${slug}.md`), 'utf8');

/** The first paragraph after the front matter. */
const opening = (slug: string) => source(slug).split(/^---$/m)[2].trim().split('\n\n')[0];

describe('blog posts that describe planned features', () => {
  it('the 2025 platform post is not featured and says what was not built', () => {
    const slug = 'orangecat-2025-complete-platform';
    expect(getBlogPost(slug)?.featured).toBe(false);
    const note = opening(slug).toLowerCase();
    expect(note).toContain("editor's note, 13 november 2026");
    for (const feature of ['multi-signature', 'payroll', 'quadratic voting', 'time-locked']) {
      expect(note).toContain(feature);
    }
    // The author's words stay as written.
    expect(source(slug)).toContain('**Quadratic voting** for fair representation');
  });

  it('the Bitcoin-alternative post says Lightning payments are not on the blockchain', () => {
    expect(opening('orangecat-bitcoin-alternative')).toMatch(/Lightning payments settle off-chain/);
  });
});
