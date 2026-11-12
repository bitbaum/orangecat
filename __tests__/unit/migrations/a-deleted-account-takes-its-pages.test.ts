/**
 * The migration that lets Delete Account succeed for someone who owns pages or
 * has traded, and keeps other people's records.
 *
 * Run against a scratch Postgres 16 with every migration replayed from zero
 * (a stand-in for auth.users, storage and the API roles underneath): on the
 * schema before it, GoTrue's `DELETE FROM auth.users` for a person who owned a
 * project failed with `null value in column "actor_id" of relation "projects"`,
 * and for a seller with an order failed on `orders_seller_id_fkey`. With it,
 * applied twice on a populated database, delete_account_pages() then the same
 * DELETE (as supabase_auth_admin) removed the person's profile, actor,
 * project, product, service, cause, loan, asset and event; kept the buyer's
 * order with seller_id NULL and the lender's loan payment with payer_id NULL;
 * left the other person's pages and wishlist alone; returned 0 on a retry;
 * still deleted an account that owned nothing; and was not executable by anon
 * or authenticated. A catalog walk afterwards found no foreign key into a row
 * an account deletion removes that is NO ACTION / RESTRICT, and SET NULL on a
 * NOT NULL column only on the eight actor_id columns the function empties
 * first. These pin that shape against a later edit. Comment-blind, because
 * the migration's prose names every identifier.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const file = readdirSync(dir).find(f => f.startsWith('20261112203000_'));
const sql = file ? readFileSync(join(dir, file), 'utf8').replace(/^[ \t]*--.*$/gm, '') : '';

const fnBody = () => {
  const start = sql.indexOf('FUNCTION public.delete_account_pages(');
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', start));
};

describe('a deleted account takes its pages and leaves others their records', () => {
  it('exists under its focus timestamp', () => {
    expect(file).toBeDefined();
  });

  it('detaches the person from every record another person keeps, instead of blocking', () => {
    for (const [table, column, target] of [
      ['orders', 'buyer_id', 'auth.users'],
      ['orders', 'seller_id', 'auth.users'],
      ['orders', 'shipping_address_id', 'public.shipping_addresses'],
      ['loan_payments', 'payer_id', 'public.profiles'],
      ['loan_payments', 'recipient_id', 'public.profiles'],
      ['event_payouts', 'created_by', 'auth.users'],
      ['task_projects', 'created_by', 'auth.users'],
      ['task_requests', 'requested_by', 'auth.users'],
      ['task_requests', 'responded_by', 'auth.users'],
      ['task_requests', 'requested_user_id', 'auth.users'],
      ['task_attention_flags', 'resolved_by', 'auth.users'],
    ]) {
      expect(sql).toMatch(new RegExp(`\\('${table}',\\s+'${column}',\\s+'${target}'\\)`));
    }
    expect(sql).toMatch(/ALTER COLUMN %I DROP NOT NULL/);
    expect(sql).toMatch(/FOREIGN KEY \(%I\) REFERENCES %s\(id\) ON DELETE SET NULL/);
  });

  it('replaces the old foreign key whatever it is called, never leaving two', () => {
    expect(sql).toMatch(/FROM pg_constraint con/);
    expect(sql).toMatch(/DROP CONSTRAINT %I/);
  });

  it("deletes what the account's actor owns, from the catalog, and only by the owner column", () => {
    const body = fnBody();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path = public/);
    expect(body).toMatch(/FROM public\.actors WHERE user_id = p_user/);
    expect(body).toMatch(/public\.actor_owner_columns\(\) WHERE column_name = 'actor_id'/);
    expect(body).toMatch(/DELETE FROM public\.%I WHERE actor_id = \$1/);
  });

  it('is callable by the service role only', () => {
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.delete_account_pages(uuid) FROM PUBLIC, anon, authenticated;'
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_account_pages(uuid) TO service_role;'
    );
  });
});
