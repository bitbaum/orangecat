/**
 * Open peer review — the rules a funder reads a verdict by.
 *
 * The database enforces append-only and no-self-review; these pin the domain
 * layer that explains them in words, and the hash that lets anyone check a
 * review was not altered.
 */

import { createHash } from 'node:crypto';
import { createResearchReview, reviewInputSchema } from '@/domain/research/reviews';

const RESEARCH_ID = '11111111-1111-4111-8111-111111111111';
const OWNER = 'owner-user';
const REVIEWER = 'reviewer-user';
const REVIEWER_ACTOR = 'reviewer-actor';
const BODY = 'Re-ran the notebook on the published dataset; the effect size matches to 2 d.p.';

function mockSupabase(research: Record<string, unknown> | null) {
  const inserts: Array<Record<string, unknown>> = [];
  const supabase = {
    from: (table: string) => {
      if (table === 'research_reviews') {
        return {
          insert: (row: Record<string, unknown>) => {
            inserts.push(row);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: 'rev-1', body_sha256: row.body_sha256, created_at: 'now' },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: research, error: null }) }),
        }),
      };
    },
  };
  return { supabase, inserts };
}

const publicResearch = {
  id: RESEARCH_ID,
  user_id: OWNER,
  is_public: true,
  output_links: ['https://github.com/x/y'],
};

describe('reviewInputSchema', () => {
  it('asks for substance, not a thumbs-up', () => {
    expect(reviewInputSchema.safeParse({ verdict: 'supports', body: 'great' }).success).toBe(false);
  });

  it('reads an untouched output select as the project as a whole', () => {
    const parsed = reviewInputSchema.parse({ verdict: 'concerns', body: BODY, output_link: '' });
    expect(parsed.output_link).toBeNull();
  });

  it('refuses a verdict outside the list', () => {
    expect(reviewInputSchema.safeParse({ verdict: 'amazing', body: BODY }).success).toBe(false);
  });
});

describe('createResearchReview', () => {
  it('stores a hash anyone can recompute from the body', async () => {
    const { supabase, inserts } = mockSupabase(publicResearch);
    const result = await createResearchReview(
      supabase as never,
      RESEARCH_ID,
      REVIEWER,
      REVIEWER_ACTOR,
      { verdict: 'reproduced', body: BODY, output_link: 'https://github.com/x/y' }
    );
    expect(result.ok).toBe(true);
    expect(inserts[0]).toMatchObject({
      reviewer_actor_id: REVIEWER_ACTOR,
      body_sha256: createHash('sha256').update(BODY).digest('hex'),
      output_link: 'https://github.com/x/y',
    });
  });

  it('refuses self-review, and says what to do instead', async () => {
    const { supabase, inserts } = mockSupabase(publicResearch);
    const result = await createResearchReview(supabase as never, RESEARCH_ID, OWNER, 'a', {
      verdict: 'supports',
      body: BODY,
    });
    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
    expect(inserts).toHaveLength(0);
  });

  it('refuses a review of an output the research does not list', async () => {
    const { supabase } = mockSupabase(publicResearch);
    const result = await createResearchReview(supabase as never, RESEARCH_ID, REVIEWER, 'a', {
      verdict: 'refutes',
      body: BODY,
      output_link: 'https://example.org/elsewhere',
    });
    expect(result).toMatchObject({ ok: false, code: 'bad_request' });
  });

  it('treats private or missing research as not found', async () => {
    for (const research of [null, { ...publicResearch, is_public: false }]) {
      const { supabase } = mockSupabase(research);
      const result = await createResearchReview(supabase as never, RESEARCH_ID, REVIEWER, 'a', {
        verdict: 'supports',
        body: BODY,
      });
      expect(result).toMatchObject({ ok: false, code: 'not_found' });
    }
  });
});
