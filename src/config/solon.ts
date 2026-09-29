/**
 * Solon integration config — the ONE place OrangeCat knows about its
 * governance layer (solon.orangecat.ch).
 *
 * Solon is the legitimacy root: platform policies here change only via a
 * Bitcoin-signed Solon vote whose decision document OrangeCat re-verifies
 * locally (src/services/solon/). The values below are protocol-level
 * constants shared with the Solon deployment — the org id matches Solon's
 * seeded organization #1, and GENESIS_ALLOCATION_POLICY is byte-identical to
 * Solon's seeded allocation_policy v1 (both sides bootstrap from the same
 * content, so the version chains agree from the start).
 */

export const SOLON_BASE_URL_DEFAULT = 'https://solon.orangecat.ch';

/** Solon organization #1 = the OrangeCat platform (seeded in Solon's 1_seed_org1 migration). */
export const SOLON_ORG_ID = '84c9b96e-31a5-4b62-bb2f-0d05a53c31f7';
export const SOLON_ORG_SLUG = 'orangecat';

export const ALLOCATION_POLICY_KEY = 'allocation_policy';

/**
 * The platform-wide leash on the Cat's spending, enforced as an additional
 * ceiling over per-user cat_permissions caps in the payment path.
 */
export interface AllocationPolicyContent {
  /** Max total BTC the Cat may move platform-wide per day (all users combined). */
  max_cat_daily_spend_btc: number;
  /** Max BTC per single Cat payment action, platform-wide. */
  max_cat_btc_per_action: number;
}

/** Genesis (v1, bootstrap) — identical to Solon's seeded allocation_policy v1. */
export const GENESIS_ALLOCATION_POLICY: AllocationPolicyContent = {
  max_cat_daily_spend_btc: 0.001,
  max_cat_btc_per_action: 0.00025,
};

/**
 * Solon decision categories OrangeCat pre-fills (Solon's DECISION_CATEGORIES,
 * src/lib/db/enums.ts). Only fileable ones: Solon ignores any other value and
 * falls back to OPERATIONS.
 */
export const SOLON_PROPOSAL_CATEGORY = {
  TREASURY_SPEND: 'TREASURY_SPEND',
  OPERATIONS: 'OPERATIONS',
} as const;
