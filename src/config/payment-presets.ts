/**
 * Payment amount presets — SSOT for BTC quick-pick buttons across the app.
 *
 * Different surfaces need different scales:
 * - Micro picks for in-app contribution dialogs (~$1–$100 at $100k/BTC)
 * - Labeled tiers for public/project support (Small/Medium/Large)
 */

/**
 * Quick-select amounts offered as suggestions beneath AmountField.
 *
 * TWO ladders, because a suggestion is only useful if it is round in the unit
 * the payer is reading. Offering the BTC ladder to someone entering CHF renders
 * as "CHF 0.52 · CHF 2.59 · CHF 5.18" — arithmetic noise nobody would ever pick
 * deliberately. The fiat ladder is round in fiat and converted to BTC on tap;
 * the BTC ladder is round in BTC for anyone entering in BTC.
 */
export const CONTRIBUTION_QUICK_AMOUNTS_BTC = [0.00001, 0.00005, 0.0001, 0.0005, 0.001] as const;

/** Round amounts in the payer's own currency, converted to BTC when chosen. */
export const CONTRIBUTION_QUICK_AMOUNTS_FIAT = [1, 5, 10, 20, 50] as const;

/** Default contribution when the payer hasn't chosen an amount yet. */
export const DEFAULT_CONTRIBUTION_BTC = 0.0001;

/**
 * Labeled support tiers for public pay panels. Roughly 10 / 50 / 200 in USD at
 * 100k per BTC. They were 0.001 / 0.005 / 0.01 — about 100 / 500 / 1,000 —
 * which made "Small" a hundred dollars, and the larger two more than a new
 * Lightning wallet can comfortably receive.
 */
export const LABELED_SUPPORT_AMOUNTS_BTC = [
  { btc: 0.0001, label: 'Small' },
  { btc: 0.0005, label: 'Medium' },
  { btc: 0.002, label: 'Large' },
] as const;
