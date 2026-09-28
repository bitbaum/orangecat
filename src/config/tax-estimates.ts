/**
 * Income-tax ESTIMATES — a rough number with its sources, never a filing.
 *
 * Why this exists: a personal overview that shows income, debts and voluntary
 * giving but not what the public will take is a picture with the biggest
 * figure missing. Why it is an estimate: real tax depends on deductions,
 * status, wealth, church membership and the year's multipliers, none of which
 * we ask for. So every table here carries its source, its year and its
 * assumptions, and every surface that renders one says "estimate" in the same
 * sentence as the number (TAX_ESTIMATE_COPY.caveat).
 *
 * Adding a jurisdiction = adding an entry. The computation is in
 * src/domain/finances/tax.ts and reads only this.
 */

export interface TaxBracket {
  /** Taxable income from which this marginal rate applies, in the table's currency. */
  from: number;
  /** Marginal rate as a fraction (0.02 = 2%). */
  rate: number;
}

export interface TaxTable {
  id: string;
  label: string;
  currency: 'CHF';
  /** The year the figures are for. */
  year: number;
  /** Who the table is for; the estimate is wrong for anyone else and says so. */
  assumptions: readonly string[];
  /** Progressive layers, each applied to the income above `from`. */
  federal: readonly TaxBracket[];
  /** Cantonal basic tariff ("einfache Staatssteuer"), before multipliers. */
  cantonalBasic: readonly TaxBracket[];
  /** Multipliers applied to the basic tariff, as fractions (1.19 = 119%). */
  multipliers: readonly { name: string; factor: number }[];
  sources: readonly { name: string; url: string }[];
}

/**
 * Zürich city, single taxpayer, 2025. Marginal-rate reading of the federal
 * tariff (DBG Art. 36, indexed 2025) and the cantonal basic tariff (StG ZH § 35,
 * single), times the 2025 cantonal (98%) and city (119%) multipliers. No church
 * tax, no deductions, no wealth tax.
 */
export const ZURICH_CITY_SINGLE_2025: TaxTable = {
  id: 'ch-zh-zurich-single',
  label: 'Zürich (city), single',
  currency: 'CHF',
  year: 2025,
  assumptions: [
    'Single, no children, no church tax',
    'Taxable income = the income shown, with no deductions',
    'Resident in the city of Zürich the whole year',
    'Income tax only — no wealth tax, no social contributions',
  ],
  federal: [
    { from: 0, rate: 0 },
    { from: 15_200, rate: 0.0077 },
    { from: 33_200, rate: 0.0088 },
    { from: 43_500, rate: 0.0264 },
    { from: 58_000, rate: 0.0297 },
    { from: 76_100, rate: 0.0594 },
    { from: 82_000, rate: 0.066 },
    { from: 108_800, rate: 0.088 },
    { from: 141_500, rate: 0.11 },
    { from: 185_100, rate: 0.132 },
  ],
  cantonalBasic: [
    { from: 0, rate: 0 },
    { from: 6_900, rate: 0.02 },
    { from: 11_800, rate: 0.03 },
    { from: 16_700, rate: 0.04 },
    { from: 23_700, rate: 0.05 },
    { from: 32_100, rate: 0.06 },
    { from: 42_400, rate: 0.07 },
    { from: 57_700, rate: 0.08 },
    { from: 81_300, rate: 0.09 },
    { from: 115_200, rate: 0.1 },
    { from: 161_400, rate: 0.11 },
    { from: 221_700, rate: 0.12 },
    { from: 262_800, rate: 0.13 },
  ],
  multipliers: [
    { name: 'Canton of Zürich (98%)', factor: 0.98 },
    { name: 'City of Zürich (119%)', factor: 1.19 },
  ],
  sources: [
    {
      name: 'ESTV — Steuerrechner (federal, cantonal and communal tax, all years)',
      url: 'https://swisstaxcalculator.estv.admin.ch/',
    },
    {
      name: 'Kanton Zürich — Steuertarife und Steuerfüsse',
      url: 'https://www.zh.ch/de/steuern-finanzen/steuern/steuertarife-steuerfuesse.html',
    },
    {
      name: 'Stadt Zürich — Steuerfuss 2025',
      url: 'https://www.stadt-zuerich.ch/de/politik-und-verwaltung/finanzen/steuern.html',
    },
  ],
};

export const TAX_TABLES: readonly TaxTable[] = [ZURICH_CITY_SINGLE_2025];

/** The table for a place, when we have one. Zürich first; others as they are added. */
export function taxTableFor(place: {
  country_code: string;
  region: string;
  locality: string;
}): TaxTable | null {
  const country = place.country_code.trim().toUpperCase();
  const locality = place.locality.trim().toLowerCase();
  const region = place.region.trim().toLowerCase();
  if (
    country === 'CH' &&
    (locality.startsWith('zürich') ||
      locality.startsWith('zurich') ||
      region.startsWith('zürich') ||
      region.startsWith('zurich'))
  ) {
    return ZURICH_CITY_SINGLE_2025;
  }
  return null;
}

export const TAX_ESTIMATE_COPY = {
  title: 'What the public would take',
  caveat:
    'An estimate, not a filing: it assumes the income shown is your taxable income with no deductions, and the table named below. Your real bill will differ. Check it with the official calculator before deciding anything.',
  noTable: (place: string) =>
    `No tax table for ${place} yet. The estimate is built per place from official tariffs, Zürich first; yours can be added.`,
  noPlace: 'Declare your civic split — it names the place your tax estimate is built for.',
} as const;
