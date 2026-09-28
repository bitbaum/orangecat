/**
 * Groups Service Validation
 *
 * Request validation using Zod schemas.
 * Uses only the new unified groups types.
 *
 * Created: 2025-01-30
 * Last Modified: 2026-03-31
 * Last Modified Summary: Remove as-any casts by typing .includes() properly
 */

import { z } from 'zod';
import { webUrl } from '@/lib/validation/base';
import { GROUP_LABEL_IDS, GROUP_LABELS, type GroupLabel } from '@/config/group-labels';
import { GOVERNANCE_PRESETS, type GovernancePreset } from '@/config/governance-presets';
import {
  LEGAL_STATUSES,
  PLACE_NAME_MAX,
  legalProblem,
  placeProblem,
  kindOf,
} from '@bitbaum/collective-kinds';

// Valid label values — the kinds in @bitbaum/collective-kinds, via GROUP_LABELS.
const validLabelsTuple = [...GROUP_LABEL_IDS] as [GroupLabel, ...GroupLabel[]]; // For zod.enum

// Valid governance presets - auto-derived from config (SSOT)
const validGovernancePresetsTuple = Object.keys(GOVERNANCE_PRESETS) as [
  GovernancePreset,
  ...GovernancePreset[],
]; // For zod.enum

// Valid visibility values from config
const validVisibilities = ['public', 'members_only', 'private'] as const;

interface PlaceAndLegalFields {
  label?: GroupLabel;
  country_code?: string | null;
  region?: string | null;
  locality?: string | null;
  legal_status?: (typeof LEGAL_STATUSES)[number];
  legal_form?: string | null;
  jurisdiction?: string | null;
  register_id?: string | null;
  recognised_on?: string | null;
}

const PLACE_MESSAGE: Record<string, string> = {
  country_code: 'Which country is it in? (two letters, e.g. CH)',
  region: 'Which region — canton, state or province?',
  locality: 'Which locality — village, quarter or town?',
};

/**
 * Two rules the field types cannot express, both answered by the package:
 *  - a place-bound kind needs a complete place (all three levels);
 *  - a legal status needs the evidence that earns it, and a kind that can
 *    never be tax-exempt cannot claim to be.
 * Point at ONE field so the form can show the message under it.
 */
function refinePlaceAndLegal(data: PlaceAndLegalFields, ctx: z.RefinementCtx): void {
  const kind = kindOf(data.label);
  const anyPlace = Boolean(data.country_code || data.region || data.locality);
  if (kind?.needsPlace || anyPlace) {
    const problem = placeProblem({
      country_code: data.country_code ?? undefined,
      region: data.region ?? undefined,
      locality: data.locality ?? undefined,
    });
    if (problem) {
      ctx.addIssue({
        code: 'custom',
        path: [problem],
        message: kind?.needsPlace
          ? `A ${GROUP_LABELS[kind.id].name.toLowerCase()} belongs to a place. ${PLACE_MESSAGE[problem]}`
          : PLACE_MESSAGE[problem],
      });
    }
  }
  if (data.legal_status && data.legal_status !== 'informal') {
    const problem = legalProblem(
      {
        status: data.legal_status,
        legal_form: data.legal_form ?? undefined,
        jurisdiction: data.jurisdiction ?? undefined,
        register_id: data.register_id ?? undefined,
        recognised_on: data.recognised_on ?? undefined,
      },
      kind
    );
    if (problem === 'kind_cannot_be_tax_exempt') {
      ctx.addIssue({
        code: 'custom',
        path: ['legal_status'],
        message: `A ${kind?.name.toLowerCase() ?? 'group'} of this kind cannot be recognised as tax-exempt.`,
      });
    } else if (problem) {
      ctx.addIssue({
        code: 'custom',
        path: [problem],
        message: 'Needed for the legal status you chose.',
      });
    }
  }
}

/**
 * Zod schema for create group request (for runtime validation)
 */
export const createGroupSchema = z
  .object({
    name: z.string().min(3).max(100),
    slug: z.string().optional(),
    description: z.string().max(2000).optional(),
    label: z.enum(validLabelsTuple),
    tags: z.array(z.string()).optional(),
    avatar_url: webUrl().optional().nullable().or(z.literal('')),
    banner_url: webUrl().optional().nullable().or(z.literal('')),
    is_public: z.boolean().optional(),
    visibility: z.enum(validVisibilities).optional(),
    bitcoin_address: z.string().optional().nullable(),
    lightning_address: z.string().optional().nullable(),
    governance_preset: z.enum(validGovernancePresetsTuple).optional(),
    voting_threshold: z.number().int().min(1).max(100).optional().nullable(),
    // Where it belongs. Optional for most kinds; a place-bound kind (town,
    // local fund) cannot be created without all three — see the refinement.
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Use the two-letter country code, e.g. CH')
      .optional()
      .nullable(),
    region: z.string().trim().min(1).max(PLACE_NAME_MAX).optional().nullable(),
    locality: z.string().trim().min(1).max(PLACE_NAME_MAX).optional().nullable(),
    // What it legally is — a claim with evidence, validated by the package.
    legal_status: z.enum(LEGAL_STATUSES).optional(),
    legal_form: z.string().trim().max(120).optional().nullable(),
    jurisdiction: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .nullable(),
    register_id: z.string().trim().max(60).optional().nullable(),
    recognised_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  })
  .superRefine(refinePlaceAndLegal);

/**
 * Zod schema for update group request (all fields optional)
 */
export const updateGroupSchema = z
  .object({
    name: z.string().min(3).max(100).optional(),
    description: z.string().max(2000).optional().nullable(),
    label: z.enum(validLabelsTuple).optional(),
    tags: z.array(z.string()).optional(),
    avatar_url: webUrl().optional().nullable().or(z.literal('')),
    banner_url: webUrl().optional().nullable().or(z.literal('')),
    is_public: z.boolean().optional(),
    visibility: z.enum(validVisibilities).optional(),
    bitcoin_address: z.string().optional().nullable(),
    lightning_address: z.string().optional().nullable(),
    governance_preset: z.enum(validGovernancePresetsTuple).optional(),
    voting_threshold: z.number().int().min(1).max(100).optional().nullable(),
    // Where it belongs. Optional for most kinds; a place-bound kind (town,
    // local fund) cannot be created without all three — see the refinement.
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Use the two-letter country code, e.g. CH')
      .optional()
      .nullable(),
    region: z.string().trim().min(1).max(PLACE_NAME_MAX).optional().nullable(),
    locality: z.string().trim().min(1).max(PLACE_NAME_MAX).optional().nullable(),
    // What it legally is — a claim with evidence, validated by the package.
    legal_status: z.enum(LEGAL_STATUSES).optional(),
    legal_form: z.string().trim().max(120).optional().nullable(),
    jurisdiction: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/)
      .optional()
      .nullable(),
    register_id: z.string().trim().max(60).optional().nullable(),
    recognised_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  })
  .superRefine(refinePlaceAndLegal);

export type CreateGroupSchemaType = z.infer<typeof createGroupSchema>;

/**
 * Input for creating a new group — derived from the Zod schema (SSOT).
 * Re-exported from @/types/group for consumers of the types module.
 */
export type CreateGroupInput = CreateGroupSchemaType;
