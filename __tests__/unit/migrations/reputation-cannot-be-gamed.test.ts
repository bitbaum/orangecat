/**
 * Reputation hardening (ADR-0010). Each assertion pins a way a signed-in person
 * could bend the record by writing to the database directly; the migration was
 * also run against scratch Postgres with each attack attempted.
 *
 * Source-level because DDL is not unit-testable here; comment-blind because
 * the migration's prose names every identifier.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HEADLINE_QUESTION,
  REVIEW_QUESTIONS,
  REVIEWER_ROLES,
  questionLabel,
} from '@/config/reputation';

const raw = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261011120000_reputation_cannot_be_gamed.sql'),
  'utf8'
);
const sql = raw.replace(/^[ \t]*--.*$/gm, '');
const fn = (name: string) => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  return sql.slice(start, sql.indexOf('$$;', start));
};

describe('a seller cannot bury their own track record', () => {
  const body = fn('actors_created_at_is_the_servers');

  it('stamps a new actor with the server clock for anyone writing through the API', () => {
    expect(body).toMatch(/current_user IN \('anon', 'authenticated'\)/);
    expect(body).toMatch(/TG_OP = 'INSERT'[\s\S]*NEW\.created_at := now\(\)/);
  });

  it('never lets them move an existing actor’s birth date', () => {
    expect(body).toMatch(/NEW\.created_at := OLD\.created_at/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.actors/);
  });
});

describe('a review answers only the questions asked', () => {
  const ids = fn('deal_review_question_ids');

  it.each(REVIEWER_ROLES)('the database asks %s exactly what the config asks', role => {
    const m = ids.match(new RegExp(`WHEN '${role}' THEN ARRAY\\[([^\\]]*)\\]`));
    const inSql = (m?.[1] ?? '').split(',').map(s => s.trim().replace(/'/g, ''));
    expect(inSql.sort()).toEqual(REVIEW_QUESTIONS[role].map(q => q.id).sort());
  });

  it('refuses unknown keys and requires the headline', () => {
    const placed = fn('deal_review_is_placed');
    expect(placed).toMatch(/k <> ALL \(public\.deal_review_question_ids\(NEW\.reviewer_role\)\)/);
    expect(placed).toContain(`NEW.answers ? '${HEADLINE_QUESTION}'`);
  });

  it('never prints a key nobody asked, even one already stored', () => {
    expect(questionLabel('This seller is a fraud, call +41 00 000 00 00')).toBeNull();
    expect(questionLabel(HEADLINE_QUESTION)).toBe(REVIEW_QUESTIONS.customer[0].label);
  });
});

describe('the hash is the database’s, not the writer’s', () => {
  it('computes a review body’s hash', () => {
    expect(fn('deal_review_is_placed')).toMatch(
      /NEW\.body_sha256 := CASE[\s\S]*encode\(sha256\(convert_to\(NEW\.body, 'UTF8'\)\), 'hex'\)/
    );
  });

  it('computes a reply’s hash', () => {
    expect(fn('deal_review_reply_is_hashed')).toMatch(
      /NEW\.body_sha256 := encode\(sha256\(convert_to\(NEW\.body, 'UTF8'\)\), 'hex'\)/
    );
    expect(sql).toMatch(/BEFORE INSERT ON public\.deal_review_replies/);
  });
});
