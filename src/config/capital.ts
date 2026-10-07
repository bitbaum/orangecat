import { ECOSYSTEM } from './ecosystem';

/**
 * Capital in the open — which public entities raise money for each product.
 *
 * A product raises on three rails, and each rail is an ordinary public
 * OrangeCat entity anyone can open: a project to FUND (no strings), a loan to
 * LEND to (repaid on terms), an investment to INVEST in (a return is owed).
 * The figures shown beside a roadmap are read live from those entities —
 * nothing here holds an amount, so nothing here can go stale or flatter.
 *
 * A rail with no entity is shown as "not open yet" and says why, rather than
 * hidden: an absent loan is a fact a reader should be able to see.
 */
export interface CapitalRails {
  /** Shown in headings: "Back Loki". */
  title: string;
  /** The funding project — gifts toward the roadmap. */
  projectId: string;
  /** A public loan the product would repay. Null until terms are set. */
  loanId: string | null;
  /** A public investment offering. Null when none is open. */
  investmentId: string | null;
}

export const CAPITAL = {
  orangecat: {
    title: ECOSYSTEM.orangeCat.title,
    projectId: ECOSYSTEM.orangeCat.projectId,
    loanId: null,
    investmentId: null,
  },
  loki: {
    title: ECOSYSTEM.loki.title,
    projectId: ECOSYSTEM.loki.projectId,
    loanId: null,
    investmentId: '3eea8a36-3ca1-4cd6-88c9-cb31150a830b',
  },
} as const satisfies Record<string, CapitalRails>;

export type CapitalSlug = keyof typeof CAPITAL;

export function isCapitalSlug(slug: string): slug is CapitalSlug {
  return Object.prototype.hasOwnProperty.call(CAPITAL, slug);
}
