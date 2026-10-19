# REVIEW.md — orangecat review bar

Judge the DIFF against these gates, in order. Flag correctness and requirement
gaps only — lint owns style. Global standards load via CLAUDE.md; this file is
ONLY orangecat's scars.

## Fatal invariants (one violation = block)

1. **Ownership is `actor_id`** — never `user_id` — across schema, queries, and
   types. Mixed ownership columns fork the identity model.
2. **BTC is `NUMERIC(18,8)`** — the canonical storage AND display unit. Never
   integer satoshis in storage (`price_btc`, not `price_sats`). SATS is not a
   currency code either (removed from `src/config/currencies.ts`); BTC is the
   only Bitcoin unit. No "satoshi-first" language anywhere.
3. **Money paths need tests** — Lightning top-ups, Cat Credit charges, BTC-pass
   plan grants: any change requires the money-path suite green. Untested charge
   code does not merge.
4. **Supabase is SELF-HOSTED only** — the managed cloud project and the
   `mcp_supabase_*` MCP tooling are RETIRED. Migrations: files in
   `supabase/migrations/` (never edit applied ones), applied automatically on
   deploy by `scripts/apply-migrations.sh` — never by hand.
5. **Entity taxonomy from `src/config/entity-registry.ts`** — no entity types,
   labels, or routes defined anywhere else.

## Product-language gates

- "pseudonymous" NEVER appears on the homepage (use "any identity", "no
  verification required"); deeper pages (/about, docs) may use it.
- CHF is the default fiat display currency.
- The warm accent `#ff5c00` (`bg-accent-warm`) is the only brand accent.
  Bitcoin orange `#f7931a` is for Bitcoin-related UI only.

## Process gates

- `verify`/CI green before review (incl. migration-replay + gitleaks jobs).
- Diff updates CLAUDE.md/docs if it changes documented structure/behavior.
- Second fix of the same bug class ships the rule/test that ends the class.
