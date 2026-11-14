/**
 * /terms and /privacy name the operator only as "Cato", with no legal name or
 * address. The legal entity is not known and must not be invented: it is read
 * from ONE constant (config/legal.ts), which is unset. Unset, the pages say
 * what they said before and stay marked Draft; set, they carry the facts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTACT_EMAIL } from '@/config/brand';
import {
  INTERIM_OPERATOR_NAME,
  LEGAL_OPERATOR,
  operatorContactLines,
  operatorName,
  type LegalOperator,
} from '@/config/legal';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '@/config/legal-content';

const contact = (doc: typeof PRIVACY_POLICY) =>
  doc.sections.find(section => section.heading === 'Contact')?.paragraphs;

describe('while the legal entity is unset', () => {
  it('is unset: nobody has supplied it, and nothing guesses it', () => {
    expect(LEGAL_OPERATOR).toBeNull();
  });

  it('keeps both documents marked Draft', () => {
    expect(PRIVACY_POLICY.draft).toBe(true);
    expect(TERMS_OF_SERVICE.draft).toBe(true);
  });

  it('says what the pages said before, and no more', () => {
    expect(PRIVACY_POLICY.intro[0]).toContain('operated by Cato, collects');
    expect(TERMS_OF_SERVICE.intro[0]).toContain('operated by Cato (herein');
    expect(contact(PRIVACY_POLICY)).toEqual([`Cato (Data Controller) — ${CONTACT_EMAIL}`]);
    expect(contact(TERMS_OF_SERVICE)).toEqual([`Cato — ${CONTACT_EMAIL}`]);
  });
});

describe('once the owner supplies it', () => {
  const operator: LegalOperator = {
    legalName: 'Example Operator',
    street: 'Example Street 1',
    postalCode: '0000',
    city: 'Example City',
    country: 'Exampleland',
    contactEmail: 'legal@example.test',
  };

  it('names the operator by its legal name', () => {
    expect(operatorName(operator)).toBe('Example Operator');
    expect(operatorName(null)).toBe(INTERIM_OPERATOR_NAME);
  });

  it('prints name, postal address and contact, with the role where given', () => {
    expect(operatorContactLines('Data Controller', operator)).toEqual([
      'Example Operator (Data Controller)',
      'Example Street 1, 0000 Example City, Exampleland',
      'legal@example.test',
    ]);
    expect(operatorContactLines(undefined, { ...operator, registration: 'Register 123' })).toEqual([
      'Example Operator',
      'Example Street 1, 0000 Example City, Exampleland',
      'Register 123',
      'legal@example.test',
    ]);
  });
});

describe('one place', () => {
  it('the documents never type the operator themselves', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'config', 'legal-content.ts'), 'utf8');
    expect(source).not.toMatch(/\bCato\b/);
    expect(source).toContain("from '@/config/legal'");
  });
});
