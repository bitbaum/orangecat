/**
 * Stakeholder relationship contract SSOT.
 *
 * Typed edges between a project and competitors, collaborators, investors,
 * customers, employees, acquirers, acquisition targets, or in-house dev
 * projects. OrangeCat stores the graph; Loki and other clients read it
 * via /api/v1/stakeholders or the internal /api/stakeholders session route.
 *
 * Created: 2026-07-09
 * Last Modified: 2026-07-09
 * Last Modified Summary: Initial — kinds enum + create schema extracted from route handler.
 */

import { z } from 'zod';
import { webUrl } from '@/lib/validation/base';

/** Stakeholder categories — mirrors stakeholder_relationships.kind CHECK constraint. */
export const STAKEHOLDER_KINDS = [
  'competitor',
  'collaborator',
  'investor',
  'customer',
  'employee',
  'acquirer',
  'acquisition_target',
  'in_house_dev',
] as const;

export type StakeholderKind = (typeof STAKEHOLDER_KINDS)[number];

export const createStakeholderSchema = z
  .object({
    fromProjectId: z.string().guid('fromProjectId must be a UUID'),
    kind: z.enum(STAKEHOLDER_KINDS),
    toActorId: z.string().guid().optional(),
    toProjectId: z.string().guid().optional(),
    toExternalUrl: webUrl().optional(),
    toExternalName: z.string().min(1).max(200).optional(),
    status: z.string().max(50).optional(),
    confidence: z.number().int().min(0).max(100).optional(),
    notes: z.string().max(5000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    data => {
      const set = [data.toActorId, data.toProjectId, data.toExternalUrl].filter(Boolean).length;
      return set === 1;
    },
    {
      message: 'Exactly one of toActorId, toProjectId, or toExternalUrl must be set',
    }
  );

export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;

export function isStakeholderKind(value: string): value is StakeholderKind {
  return (STAKEHOLDER_KINDS as readonly string[]).includes(value);
}
