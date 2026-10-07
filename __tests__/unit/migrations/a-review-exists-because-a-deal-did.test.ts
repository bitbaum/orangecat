/**
 * The migration that makes reviews unforgeable by construction (ADR-0010).
 *
 * Each assertion pins one rule that has to hold in the database rather than in
 * a route someone remembers to check. The migration was also run against a
 * scratch Postgres 16 with every rule exercised (stranger, impersonation,
 * second review, edit, closed window, non-boolean answer, self-dealing order);
 * these keep a later edit from quietly undoing any of them.
 *
 * Source-level because DDL is not unit-testable here; comment-blind because
 * the migration's own prose names every one of these identifiers.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261005120000_deals_and_deal_reviews.sql'),
  'utf8'
);
// Strip `-- ...` comments so prose cannot satisfy a code assertion.
const sql = raw.replace(/^[ \t]*--.*$/gm, '');

describe('a deal is observed, never declared', () => {
  it('gives people no way to write a deal', () => {
    expect(sql).toMatch(/GRANT SELECT ON public\.deals TO authenticated;/);
    expect(sql).not.toMatch(/CREATE POLICY \w+ ON public\.deals\s+FOR (INSERT|UPDATE|DELETE|ALL)/);
  });

  it('refuses a deal with yourself', () => {
    expect(sql).toMatch(/CHECK \(provider_actor_id <> customer_actor_id\)/);
  });

  it('records an order once the money has settled, and never because of a tip', () => {
    expect(sql).toMatch(
      /CREATE TRIGGER orders_become_deals\s+AFTER INSERT OR UPDATE OF status ON public\.orders/
    );
    expect(sql).toMatch(/WHEN 'paid' THEN 'settled'/);
    expect(sql).not.toMatch(/payment_intents/);
  });

  it('never lets recording a deal fail the payment that caused it', () => {
    expect(sql).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING/);
  });

  it('keeps who dealt with whom private to the two of them', () => {
    expect(sql).not.toMatch(/GRANT SELECT ON public\.deals TO anon/);
  });

  it("records a deal against the person's OLDEST actor, as lookupUserActor does", () => {
    // Users can hold duplicate actors; an unordered pick would split a track
    // record across them and disagree with the profile that displays it.
    expect(sql).toMatch(/ORDER BY created_at ASC, id ASC\s+LIMIT 1/);
    expect(sql).toMatch(/v_provider := public\.primary_user_actor\(NEW\.seller_id\)/);
    expect(sql).toMatch(/public\.primary_user_actor\(o\.seller_id\) AS provider/);
    expect(sql).not.toMatch(/JOIN public\.actors/);
  });
});

describe('a review belongs to a deal and to one side of it', () => {
  it('allows one review per side', () => {
    expect(sql).toMatch(/UNIQUE \(deal_id, reviewer_role\)/);
  });

  it('derives the side and the subject from the deal, for every writer', () => {
    expect(sql).toMatch(/BEFORE INSERT ON public\.deal_reviews/);
    expect(sql).toMatch(/NEW\.subject_actor_id := d\.provider_actor_id/);
    expect(sql).toMatch(/NEW\.subject_actor_id := d\.customer_actor_id/);
    expect(sql).toMatch(/Only the two people in a deal can review it/);
  });

  it('closes the window, and the window length lives in one function', () => {
    expect(sql).toMatch(/now\(\) > d\.review_closes_at/);
    const uses = sql.match(/public\.deal_review_window\(\)/g) ?? [];
    // definition + column default + backfill
    expect(uses.length).toBe(3);
  });

  it('cannot be edited', () => {
    expect(sql).toMatch(/BEFORE UPDATE ON public\.deal_reviews/);
    expect(sql).not.toMatch(/CREATE POLICY \w+ ON public\.deal_reviews\s+FOR UPDATE/);
  });

  it('has no stars — answers are booleans', () => {
    expect(sql).not.toMatch(/rating/i);
    expect(sql).toMatch(/@\.type\(\) != "boolean"/);
  });
});

describe('a review stays blind until both sides have spoken or time is up', () => {
  it('reveals on both reviews or a closed window, and nothing else', () => {
    expect(sql).toMatch(/d\.review_closes_at <= now\(\)/);
    expect(sql).toMatch(
      /count\(\*\) FROM public\.deal_reviews r WHERE r\.deal_id = p_deal_id\) >= 2/
    );
  });

  it('shows the public only revealed reviews, and the author their own', () => {
    expect(sql).toMatch(
      /CREATE POLICY deal_reviews_select ON public\.deal_reviews\s+FOR SELECT USING \(\s+public\.deal_reviews_revealed\(deal_id\)\s+OR/
    );
  });
});

describe('the public track record is counts, not deals', () => {
  it('counts distinct customers, because 40 deals with one person is a different fact', () => {
    expect(sql).toMatch(/count\(DISTINCT d\.customer_actor_id\)/);
  });

  it('is callable by anyone', () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.actor_track_record\(UUID\) TO anon/);
  });
});
