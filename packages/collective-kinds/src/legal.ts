/**
 * What a collective legally is — as a fact with evidence, never as a mood.
 *
 * Three states, strictly ordered, each earned by a document a reader could
 * ask to see:
 *
 *   informal    — people acting together; no register knows them.
 *   registered  — a legal person: a register entry with a number.
 *   tax_exempt  — registered AND recognised as public-benefit by the tax
 *                 authority (Swiss: gemeinnützig, by cantonal decision).
 *
 * The state gates what a product may SAY. Only `tax_exempt` may mention
 * deductible gifts; `registered` may name the legal form; `informal` may do
 * neither. This is the same rule evig follows for its own Verein "in
 * Gründung": until recognition is real, no page promises a receipt.
 */
import type { CollectiveKind } from './kinds';

export const LEGAL_STATUSES = ['informal', 'registered', 'tax_exempt'] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export interface LegalRecord {
  status: LegalStatus;
  /** e.g. "Verein (Art. 60 ZGB)", "GmbH". Required from `registered` on. */
  legal_form?: string;
  /** Country of registration, ISO 3166-1 alpha-2. Required from `registered` on. */
  jurisdiction?: string;
  /** The register's own identifier (Swiss: UID, CHE-…). Required from `registered` on. */
  register_id?: string;
  /** Date of the tax authority's recognition. Required for `tax_exempt`. */
  recognised_on?: string;
}

export const LEGAL_STATUS_LABEL: Readonly<Record<LegalStatus, string>> = {
  informal: 'Informal',
  registered: 'Registered',
  tax_exempt: 'Recognised tax-exempt',
};

/** 0, 1, 2 — so "at least registered" is a comparison, not a list. */
export function legalRank(status: LegalStatus): number {
  return LEGAL_STATUSES.indexOf(status);
}

export type LegalProblem =
  'legal_form' | 'jurisdiction' | 'register_id' | 'recognised_on' | 'kind_cannot_be_tax_exempt';

/**
 * What a record is missing for the status it claims, or null when it is
 * complete. A status without its evidence is refused rather than downgraded:
 * a founder who ticks "tax-exempt" and forgets the date should be told, not
 * silently recorded as "registered".
 */
export function legalProblem(record: LegalRecord, kind?: CollectiveKind): LegalProblem | null {
  if (legalRank(record.status) >= legalRank('registered')) {
    if (!record.legal_form?.trim()) {
      return 'legal_form';
    }
    if (!record.jurisdiction || !/^[A-Z]{2}$/.test(record.jurisdiction)) {
      return 'jurisdiction';
    }
    if (!record.register_id?.trim()) {
      return 'register_id';
    }
  }
  if (record.status === 'tax_exempt') {
    if (kind && !kind.canBeTaxExempt) {
      return 'kind_cannot_be_tax_exempt';
    }
    if (!record.recognised_on || !/^\d{4}-\d{2}-\d{2}$/.test(record.recognised_on)) {
      return 'recognised_on';
    }
  }
  return null;
}

/**
 * The one question every donation surface must ask before saying the word
 * "deductible". True only for a complete tax-exempt record of a kind that can
 * hold one.
 */
export function mayClaimDeductibleGifts(record: LegalRecord, kind?: CollectiveKind): boolean {
  return record.status === 'tax_exempt' && legalProblem(record, kind) === null;
}
