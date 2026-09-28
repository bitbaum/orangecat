/**
 * Group Types
 *
 * TypeScript types for the unified groups system.
 * Groups are entities of 1+ people that can own things (projects, products, etc.)
 */

import type { GroupLabel, GroupVisibility } from '@/config/group-labels';
import type { GovernancePreset, GroupRole, ActionPermission } from '@/config/governance-presets';
import type { GroupFeature } from '@/config/group-features';
import type { LegalStatus } from '@bitbaum/collective-kinds';

/**
 * Core Group entity
 */
export interface Group {
  id: string;
  name: string;
  slug: string;
  description?: string | null;

  // Identity (label is branding/template, not capability lock)
  label: GroupLabel;
  tags: string[];

  // Display
  avatar_url?: string | null;
  banner_url?: string | null;

  // Settings (all optional, can be changed anytime)
  is_public: boolean;
  visibility: GroupVisibility;
  bitcoin_address?: string | null;
  lightning_address?: string | null;

  // Governance (preset provides defaults, can be customized)
  governance_preset: GovernancePreset;
  voting_threshold?: number | null; // Override preset threshold if needed
  // Where it belongs (required for place-bound kinds: town, local_fund)
  country_code?: string | null;
  region?: string | null;
  locality?: string | null;
  // What it legally is — see @bitbaum/collective-kinds legal.ts
  legal_status?: LegalStatus;
  legal_form?: string | null;
  jurisdiction?: string | null;
  register_id?: string | null;
  recognised_on?: string | null;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Group member with role and optional permission overrides
 */
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  permission_overrides?: Partial<Record<string, ActionPermission>> | null;
  invited_by?: string | null;
  joined_at: string;
}

/**
 * Enabled feature record for a group
 */
export interface GroupFeatureRecord {
  id: string;
  group_id: string;
  feature_key: GroupFeature;
  enabled: boolean;
  config: Record<string, unknown>;
  enabled_at: string;
  enabled_by?: string | null;
}

/**
 * Group with related data (for API responses)
 */
export interface GroupWithRelations extends Group {
  members?: GroupMember[];
  features?: GroupFeatureRecord[];
  member_count?: number;
}

/**
 * Input for creating a new group.
 *
 * Derived from `createGroupSchema` (the Zod SSOT) — re-exported here so the
 * types module stays the import surface. Slug is auto-generated if not
 * provided.
 */
export type { CreateGroupInput } from '@/services/groups/validation';

/**
 * Input for updating a group
 */
export interface UpdateGroupInput {
  name?: string;
  slug?: string;
  description?: string | null;
  label?: GroupLabel;
  tags?: string[];
  avatar_url?: string | null;
  banner_url?: string | null;
  is_public?: boolean;
  visibility?: GroupVisibility;
  bitcoin_address?: string | null;
  lightning_address?: string | null;
  governance_preset?: GovernancePreset;
  voting_threshold?: number | null;
}

/**
 * Input for adding a member to a group
 */
export interface AddMemberInput {
  user_id: string;
  role?: GroupRole;
  permission_overrides?: Partial<Record<string, ActionPermission>>;
}

/**
 * Input for updating a member's role/permissions
 */
export interface UpdateMemberInput {
  role?: GroupRole;
  permission_overrides?: Partial<Record<string, ActionPermission>> | null;
}

// ============================================
// Helper Types for Entity Ownership
// ============================================

/**
 * Interface for entities that can be owned by users or groups
 */
export interface OwnedEntity {
  user_id: string;
  group_id?: string | null;
}

/**
 * Determine if an entity is owned by a user or group
 */
export function getOwnerType(entity: OwnedEntity): 'user' | 'group' {
  return entity.group_id ? 'group' : 'user';
}

/**
 * Get the owner ID (group_id if set, otherwise user_id)
 */
export function getOwnerId(entity: OwnedEntity): string {
  return entity.group_id ?? entity.user_id;
}

// ============================================
// Helper Types for Features
// ============================================

/**
 * Check if a feature is enabled for a group
 */
export function isFeatureEnabled(
  enabledFeatures: GroupFeatureRecord[],
  feature: GroupFeature
): boolean {
  return enabledFeatures.some(f => f.feature_key === feature && f.enabled);
}

/**
 * Get feature config for a specific feature
 */
export function getFeatureConfig(
  enabledFeatures: GroupFeatureRecord[],
  feature: GroupFeature
): Record<string, unknown> | null {
  const featureRecord = enabledFeatures.find(f => f.feature_key === feature && f.enabled);
  return featureRecord?.config ?? null;
}

// ============================================
// Re-exports for convenience
// ============================================

export type { GroupLabel, GroupVisibility } from '@/config/group-labels';
export type {
  GovernancePreset,
  GroupRole,
  ActionPermission,
  RolePermissions,
} from '@/config/governance-presets';
export type { GroupFeature } from '@/config/group-features';
