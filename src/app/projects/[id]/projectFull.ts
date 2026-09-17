/**
 * The shape the public project page reads.
 *
 * Extracted from page.tsx to keep that file under the component size limit —
 * the page grew when it started resolving an unclaimed owner (ADR-0005).
 *
 * Note `actor_id` alongside `user_id`: `user_id` is the account that CREATED
 * the project, `actor_id` is who it BELONGS to. For a project set up on
 * someone else's behalf those differ, and reading the wrong one shows the
 * steward as the owner.
 */

export // Mirrors ProjectPageClient's Project interface — all required fields plus known optionals
type ProjectFull = {
  id: string;
  user_id: string;
  /**
   * The owning actor. `user_id` is the creating account; `actor_id` is who the
   * project BELONGS to, and for a project set up on someone else's behalf the
   * two differ — the actor is an unclaimed placeholder (ADR-0005).
   */
  actor_id: string | null;
  title: string;
  description: string | null;
  goal_amount: number | null;
  raised_amount: number | null;
  currency: string | null;
  category: string | null;
  status: string;
  bitcoin_address: string | null;
  lightning_address: string | null;
  funding_purpose: string | null;
  website_url: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  bitcoin_balance_btc?: number | null;
  bitcoin_balance_updated_at?: string | null;
  supporters_count?: number | null;
  last_support_at?: string | null;
};
