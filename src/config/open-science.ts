/**
 * Open science — Single Source of Truth
 *
 * What a research entity's outputs are released under, which kinds of link it
 * can point at, and the limits on each. Validation (zod), the create form and
 * the public page all read from here.
 *
 * Why it exists: research on OrangeCat is funded by the people who want the
 * answer, and they are owed the answer. A licence, public outputs and a
 * pre-registration are what turn "fund a question" into open science that a
 * pseudonymous researcher can be trusted on without an institution behind them.
 */

// ==================== LICENCES ====================

/**
 * `open: true` means anyone may read, reuse and build on the work. The closed
 * option exists on purpose: saying "all rights reserved" out loud is honest,
 * and funders can decide with that in view.
 */
export const RESEARCH_LICENSES = [
  { value: 'CC-BY-4.0', label: 'CC BY 4.0 — reuse with credit', open: true },
  { value: 'CC0-1.0', label: 'CC0 — public domain', open: true },
  { value: 'CC-BY-SA-4.0', label: 'CC BY-SA 4.0 — reuse, share alike', open: true },
  { value: 'MIT', label: 'MIT — code', open: true },
  { value: 'Apache-2.0', label: 'Apache 2.0 — code', open: true },
  { value: 'GPL-3.0-or-later', label: 'GPL 3.0 or later — code, share alike', open: true },
  { value: 'all-rights-reserved', label: 'All rights reserved', open: false },
] as const;

export type ResearchLicense = (typeof RESEARCH_LICENSES)[number]['value'];

export const RESEARCH_LICENSE_VALUES = RESEARCH_LICENSES.map(l => l.value) as [
  ResearchLicense,
  ...ResearchLicense[],
];

// ==================== OUTPUT LINKS ====================

/**
 * Schemes an output may live under. `ipfs`/`ipns`/`ar` are the decentralised
 * ones; `ipfs` and `ar` are content-addressed, so the address is the hash.
 */
export const OUTPUT_LINK_SCHEMES = ['https', 'http', 'ipfs', 'ipns', 'ar'] as const;
export const CONTENT_ADDRESSED_SCHEMES = ['ipfs', 'ar'] as const;

export const OUTPUT_KINDS = [
  { value: 'preprint', label: 'Preprint / paper' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'code', label: 'Code' },
  { value: 'protocol', label: 'Protocol' },
  { value: 'link', label: 'Link' },
] as const;

export type OutputKind = (typeof OUTPUT_KINDS)[number]['value'];

/**
 * Hosts whose kind is unambiguous. Matched on the hostname or any parent
 * domain; anything else is a plain `link`. A guess is never shown as a fact —
 * an unknown host is labelled "Link", not assigned a kind it might not be.
 */
export const OUTPUT_KIND_BY_HOST: Record<string, OutputKind> = {
  'arxiv.org': 'preprint',
  'biorxiv.org': 'preprint',
  'medrxiv.org': 'preprint',
  'osf.io': 'preprint',
  'zenodo.org': 'dataset',
  'figshare.com': 'dataset',
  'datadryad.org': 'dataset',
  'huggingface.co': 'dataset',
  'github.com': 'code',
  'gitlab.com': 'code',
  'codeberg.org': 'code',
  'protocols.io': 'protocol',
};

export const OPEN_SCIENCE_LIMITS = {
  MAX_OUTPUT_LINKS: 20,
  MAX_OUTPUT_LINK_LENGTH: 500,
  MAX_PREREGISTRATION_LENGTH: 5000,
} as const;
