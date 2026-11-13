/**
 * Deleting an account removes the person's own pages and data, and never
 * another person's records.
 *
 * The first version of migration 20261112203000 let Delete Account succeed for
 * creators, but an adversarial review replayed every migration on a scratch
 * Postgres 16 and found the cascade reached past the person: a buyer's deal, a
 * backer's project_support, a lender's loan_offer and loan_payment, a guest's
 * ticket, wishlist and research contributions, bookings, contracts, event
 * payouts, and a whole conversation with the other person's own message in it.
 * A loan a member made for a group went with the member; a founder who left
 * stranded the group; and the two steps (pages, then GoTrue) were not atomic.
 *
 * The rewritten migration, replayed the same way (applied twice) with that
 * seed plus a group A founded with two other members, a group A was the only
 * member of, and a group loan: deleting A kept every one of B's rows, the
 * reference to A or A's page set NULL; handed A's group to its admin; drafted
 * the solo group's pages; kept the group loan and B's payment on it; refused
 * while an order still shipped to A's address; rolled back an identity
 * already handled when the holder's delete failed. These pin that shape.
 * Comment-blind, because the migration's prose names every identifier.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const file = readdirSync(dir).find(f => f.startsWith('20261112203000_'));
const raw = file ? readFileSync(join(dir, file), 'utf8') : '';
const sql = raw.replace(/^[ \t]*--.*$/gm, '');

const fnBody = () => {
  const start = sql.indexOf('FUNCTION public.delete_account(');
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$$;', start));
};

/** (table, column, referenced table): every one becomes ON DELETE SET NULL, nullable. */
const SET_NULL: Array<[string, string, string]> = [
  // The departing person, on a record the other party shares.
  ['orders', 'buyer_id', 'auth.users'],
  ['orders', 'seller_id', 'auth.users'],
  ['orders', 'shipping_address_id', 'public.shipping_addresses'],
  ['loan_payments', 'payer_id', 'public.profiles'],
  ['loan_payments', 'recipient_id', 'public.profiles'],
  ['loan_offers', 'offerer_id', 'public.profiles'],
  ['event_payouts', 'created_by', 'auth.users'],
  ['event_payouts', 'recipient_user_id', 'auth.users'],
  ['event_attendees', 'user_id', 'auth.users'],
  ['bookings', 'customer_user_id', 'auth.users'],
  ['bookings', 'customer_actor_id', 'public.actors'],
  ['bookings', 'provider_actor_id', 'public.actors'],
  ['deals', 'customer_actor_id', 'public.actors'],
  ['deals', 'provider_actor_id', 'public.actors'],
  ['contracts', 'party_a_actor_id', 'public.actors'],
  ['contracts', 'party_b_actor_id', 'public.actors'],
  ['payment_requests', 'requester_id', 'public.profiles'],
  ['payment_requests', 'payer_id', 'public.profiles'],
  ['conversations', 'created_by', 'public.profiles'],
  ['task_projects', 'created_by', 'auth.users'],
  ['task_requests', 'requested_by', 'auth.users'],
  ['task_requests', 'responded_by', 'auth.users'],
  ['task_requests', 'requested_user_id', 'auth.users'],
  ['task_attention_flags', 'resolved_by', 'auth.users'],
  // What a member did inside a group stays with the group.
  ['group_events', 'creator_id', 'auth.users'],
  ['group_proposals', 'proposer_id', 'public.profiles'],
  ['group_votes', 'voter_id', 'auth.users'],
  ['loans', 'user_id', 'public.profiles'],
  ['ai_assistants', 'user_id', 'public.profiles'],
  ['research_entities', 'user_id', 'public.profiles'],
  // Another person's money or offer on a page the departing person owned.
  ['loan_offers', 'loan_id', 'public.loans'],
  ['loan_payments', 'loan_id', 'public.loans'],
  ['project_support', 'project_id', 'public.projects'],
  ['event_attendees', 'event_id', 'public.events'],
  ['event_payouts', 'event_id', 'public.events'],
  ['research_contributions', 'research_entity_id', 'public.research_entities'],
  ['wishlist_contributions', 'wishlist_item_id', 'public.wishlist_items'],
];

/** Every (table, column, target) tuple the migration lists, in order. */
const listed = () =>
  [
    ...sql
      .slice(sql.indexOf('FROM (VALUES'), sql.indexOf(') AS t(table_name'))
      .matchAll(/\('(\w+)',\s+'(\w+)',\s+'([\w.]+)'\)/g),
  ].map(m => [m[1], m[2], m[3]]);

describe('a deleted account leaves other people their records', () => {
  it('exists under its focus timestamp', () => {
    expect(file).toBeDefined();
  });

  it('sets a short lock_timeout before it takes any lock', () => {
    const lock = sql.indexOf("SET LOCAL lock_timeout = '5s';");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(sql.indexOf('ALTER TABLE'));
  });

  it('lets go of every record another person keeps, instead of taking it along', () => {
    expect(listed()).toEqual(SET_NULL);
    expect(sql).toMatch(/ALTER COLUMN %I DROP NOT NULL/);
    expect(sql).toMatch(/FOREIGN KEY \(%I\) REFERENCES %s\(id\) ON DELETE SET NULL/);
  });

  it('replaces the old foreign key whatever it is called, never leaving two', () => {
    expect(sql).toMatch(/FROM pg_constraint con/);
    expect(sql).toMatch(/DROP CONSTRAINT %I/);
  });

  it('never makes a reference cascade', () => {
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
  });
});

describe('delete_account()', () => {
  it('is SECURITY DEFINER with a pinned search_path, callable by the service role only', () => {
    const body = fnBody();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path = public, pg_temp/);
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.delete_account(uuid) FROM PUBLIC, anon, authenticated;'
    );
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.delete_account(uuid) TO service_role;');
  });

  it('fails the deploy if its owner cannot delete auth users', () => {
    expect(sql).toMatch(/has_table_privilege\(current_user, 'auth\.users', 'DELETE'\)/);
  });

  it('takes the identities the account holds, and the account, in the same transaction', () => {
    const body = fnBody();
    expect(body).toMatch(/l\.holder_user_id = p_user/);
    expect(body).toMatch(/DELETE FROM auth\.users WHERE id = v_account/);
  });

  it('refuses while an order still ships to one of their addresses', () => {
    const body = fnBody();
    expect(body).toMatch(/o\.status IN \('pending_payment', 'paid'\)/);
    expect(body).toMatch(/RAISE EXCEPTION 'account_has_unshipped_orders'/);
  });

  it("deletes only what the account's actor owns, by the owner column", () => {
    const body = fnBody();
    expect(body).toMatch(/FROM public\.actors WHERE user_id = v_account/);
    expect(body).toMatch(/oc\.column_name = 'actor_id'/);
    expect(body).toMatch(/DELETE FROM public\.%I WHERE actor_id = \$1/);
  });

  it('hands a founded group to the longest-standing admin, else member', () => {
    const body = fnBody();
    expect(body).toMatch(
      /ORDER BY CASE gm\.role WHEN 'founder' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,\s+gm\.joined_at/
    );
    expect(body).toMatch(/UPDATE public\.group_members SET role = 'founder'/);
    expect(body).toMatch(/UPDATE public\.groups SET created_by = v_next\.user_id/);
  });

  it('unpublishes the pages of a group nobody else is left in, rather than deleting them', () => {
    const body = fnBody();
    expect(body).toMatch(/UPDATE public\.%I SET %s WHERE actor_id = \$1/);
    expect(body).toMatch(/'status', 'is_public', 'is_active'/);
  });

  it("keeps a paid ticket as the organiser's record, and drops a free registration", () => {
    const body = fnBody();
    expect(body).toMatch(/payment_status NOT IN \('paid', 'refunded'\)/);
    expect(body).toMatch(/SET guest_name = 'Deleted account'/);
  });
});
