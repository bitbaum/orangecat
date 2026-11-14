/**
 * Who operates the Service, legally — the ONE place it is written.
 *
 * /terms and /privacy name the operator only as "Cato", with no legal name
 * and no address (full-path review, 2026-11-13). The legal entity is not
 * known to this codebase, and nothing here may guess it: `LEGAL_OPERATOR` is
 * `null` until the owner supplies the facts.
 *
 * While it is `null`, both pages say exactly what they said before ("operated
 * by Cato", "Cato — <contact address>") and keep their Draft mark. The day
 * the object below is filled in, the opening sentence and the Contact section
 * of both documents carry the legal name, the postal address and the contact
 * address, with no other edit. Clearing the Draft mark is a separate
 * decision (`draft` in config/legal-content.ts), for after legal review.
 *
 * To fill it in, replace `null` with:
 *
 *   {
 *     legalName: '…',        // the registered name of the person or company
 *     street: '…',           // street and number
 *     postalCode: '…',
 *     city: '…',
 *     country: '…',
 *     contactEmail: '…',     // where legal and privacy requests are answered
 *     registration: '…',     // optional: register and number, as printed
 *   }
 */

import { CONTACT_EMAIL } from '@/config/brand';

export interface LegalOperator {
  /** The registered name of the natural person or company that operates the Service. */
  legalName: string;
  /** Street and number of the registered or business address. */
  street: string;
  postalCode: string;
  city: string;
  country: string;
  /** Where legal and privacy requests are answered. */
  contactEmail: string;
  /** Optional: the register and number as they should be printed. */
  registration?: string;
}

/** Unset until the owner supplies the legal entity. Never guess these. */
export const LEGAL_OPERATOR: LegalOperator | null = null;

/** The name the pages carry while the legal entity is not set. */
export const INTERIM_OPERATOR_NAME = 'Cato';

/** The operator as the documents name it in running text. */
export function operatorName(operator: LegalOperator | null = LEGAL_OPERATOR): string {
  return operator?.legalName.trim() || INTERIM_OPERATOR_NAME;
}

/**
 * The lines of a document's Contact section. Unset: one line, the interim
 * name and the contact address, as before. Set: the legal name (with its
 * role, where the document gives one), the postal address, the registration
 * when there is one, and the contact address.
 */
export function operatorContactLines(
  role?: string,
  operator: LegalOperator | null = LEGAL_OPERATOR
): string[] {
  const named = (name: string) => (role ? `${name} (${role})` : name);
  if (!operator) {
    return [`${named(INTERIM_OPERATOR_NAME)} — ${CONTACT_EMAIL}`];
  }
  return [
    named(operator.legalName.trim()),
    `${operator.street.trim()}, ${operator.postalCode.trim()} ${operator.city.trim()}, ${operator.country.trim()}`,
    ...(operator.registration?.trim() ? [operator.registration.trim()] : []),
    operator.contactEmail.trim(),
  ];
}
