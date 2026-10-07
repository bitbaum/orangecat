/**
 * The privacy pass over reputation (ADR-0010, revisited). Each assertion pins
 * a rule whose loss would publish something a person never chose to publish.
 * The migration was also run against scratch Postgres with every rule
 * exercised; these keep a later edit from quietly undoing one.
 *
 * Source-level because DDL is not unit-testable here; comment-blind because
 * the migration's prose names every identifier.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEADLINE_QUESTION } from '@/config/reputation';

const raw = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261006120000_reputation_privacy.sql'),
  'utf8'
);
const sql = raw.replace(/^[ \t]*--.*$/gm, '');
const fn = (name: string) => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  return sql.slice(start, sql.indexOf('$$;', start));
};

describe('reviews belong to the two parties', () => {
  it('takes the table away from anonymous readers', () => {
    expect(sql).toMatch(/REVOKE SELECT ON public\.deal_reviews FROM anon;/);
  });

  it('lets a party see the other side only once revealed', () => {
    expect(sql).toMatch(
      /subject_actor_id IN \(SELECT id FROM public\.actors WHERE user_id = \(SELECT auth\.uid\(\)\)\)\s+AND public\.deal_reviews_revealed\(deal_id\)/
    );
  });
});

describe('what the public sees', () => {
  const pub = fn('public_deal_reviews');

  it('is only customers reviewing a seller — a purchase never lands on the buyer', () => {
    expect(pub).toMatch(/r\.reviewer_role = 'customer'/);
    expect(pub).toMatch(/public\.deal_reviews_revealed\(r\.deal_id\)/);
  });

  it('names a reviewer only if they chose it', () => {
    expect(pub).toMatch(/CASE WHEN r\.reviewer_shown THEN r\.reviewer_actor_id END/);
    expect(sql).toMatch(/reviewer_shown BOOLEAN NOT NULL DEFAULT false/);
  });

  it('never returns the deal, its title or its amount', () => {
    expect(pub).not.toMatch(/\bd\.title\b|\bamount\b|r\.deal_id,/);
  });

  it('drops text the operator hid, keeping the record', () => {
    expect(pub).toMatch(/CASE WHEN m\.text_hidden_at IS NULL THEN r\.body END/);
  });
});

describe('the track record', () => {
  const tr = fn('actor_track_record');

  it('no longer publishes sales volume or what someone bought', () => {
    expect(tr).not.toMatch(/amount|btc|customer_actor_id = p_actor_id/i);
  });

  it('counts the headline question the config names', () => {
    expect(tr).toContain(`'${HEADLINE_QUESTION}'`);
  });

  it('counts only revealed customer reviews', () => {
    expect(tr).toMatch(/r\.reviewer_role = 'customer'/);
    expect(tr).toMatch(/public\.deal_reviews_revealed\(r\.deal_id\)/);
  });
});

describe('report and reply', () => {
  it('reports only public reviews, once each', () => {
    expect(sql).toMatch(/UNIQUE \(review_id, reporter_actor_id\)/);
    expect(sql).toMatch(/public\.deal_review_public_subject\(review_id\) IS NOT NULL/);
  });

  it('lets only the person reviewed reply, once, never edited', () => {
    expect(sql).toMatch(/author_actor_id = public\.deal_review_public_subject\(review_id\)/);
    expect(sql).toMatch(/review_id UUID PRIMARY KEY REFERENCES public\.deal_reviews/);
    expect(sql).toMatch(/BEFORE UPDATE ON public\.deal_review_replies/);
  });

  it('keeps moderation in the operator’s hands', () => {
    expect(sql).toMatch(/GRANT ALL ON public\.deal_review_moderation TO service_role;/);
    expect(sql).not.toMatch(/ON public\.deal_review_moderation TO (anon|authenticated)/);
  });
});
