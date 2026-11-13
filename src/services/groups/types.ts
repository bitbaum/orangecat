/**
 * Groups Service Types
 *
 * Re-exports types from the SSOT config files.
 * No legacy types - uses the unified groups system.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-12-29
 * Last Modified Summary: Removed legacy types, using config-based SSOT only
 */

// ==================== CONFIG-BASED TYPES (SSOT) ====================

export type { GroupLabel, GroupVisibility } from '@/config/group-labels';
export type {
  GovernancePreset,
  GroupRole,
  ActionPermission,
  RolePermissions,
} from '@/config/governance-presets';
export type { GroupFeature } from '@/config/group-features';

// ==================== CORE TYPES ====================

export type {
  Group,
  GroupMember,
  GroupFeatureRecord,
  GroupWithRelations,
  CreateGroupInput,
  UpdateGroupInput,
  AddMemberInput,
  UpdateMemberInput,
  OwnedEntity,
} from '@/types/group';

export { getOwnerType, getOwnerId, isFeatureEnabled, getFeatureConfig } from '@/types/group';

// ==================== MEMBER DETAIL TYPE ====================

/**
 * Detailed member information including profile data
 * Used when fetching members with joined profile information
 */
export interface GroupMemberDetail {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  role_type: string;
  status: 'active' | 'inactive' | 'suspended';
  joined_at: string;
  invited_by: string | null;
  voting_weight: number;
  equity_percentage: number | null;
  permissions: Record<string, unknown> | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

// ==================== SERVICE REQUEST/RESPONSE TYPES ====================

export interface GroupResponse {
  success: boolean;
  group?: import('@/types/group').Group;
  error?: string;
}

export interface GroupsListResponse {
  success: boolean;
  groups?: import('@/types/group').Group[];
  total?: number;
  error?: string;
}

export interface GroupMemberResponse {
  success: boolean;
  member?: import('@/types/group').GroupMember;
  error?: string;
}

export interface GroupMembersResponse {
  success: boolean;
  members?: GroupMemberDetail[];
  total?: number;
  error?: string;
}

// ==================== QUERY TYPES ====================

export interface GroupsQuery {
  label?: import('@/config/group-labels').GroupLabel;
  governance_preset?: import('@/config/governance-presets').GovernancePreset;
  is_public?: boolean;
  visibility?: import('@/config/group-labels').GroupVisibility;
  has_treasury?: boolean;
  search?: string;
  sort_by?: 'created_at' | 'name' | 'member_count';
  sort_order?: 'asc' | 'desc';
  // Legacy compatibility fields (mapped to new fields in queries)
  type?: string;
  governance_model?: string;
  category?: string;
  member_count_min?: number;
  member_count_max?: number;
}

// ==================== WALLET TYPES ====================

/**
 * Group wallet summary for display
 * Maps to group_wallets table schema
 */
export interface GroupWalletSummary {
  id: string;
  name: string;
  description?: string;
  purpose?: string; // 'general' | 'projects' | 'investment' | 'community' | 'emergency' | 'savings' | 'other'
  bitcoin_address?: string;
  lightning_address?: string;
  current_balance_btc: number;
  /** When current_balance_btc was read from the chain; null = never (the 0 is the column default). */
  balance_updated_at: string | null;
  is_active: boolean;
  can_access: boolean; // Based on group membership
  required_signatures: number;
}

export interface GroupWalletsResponse {
  success: boolean;
  wallets?: GroupWalletSummary[];
  error?: string;
}

/**
 * Request to create a new group wallet
 * Matches group_wallets table schema
 */
export interface CreateGroupWalletRequest {
  group_id: string;
  name: string;
  description?: string;
  purpose?: string;
  bitcoin_address?: string;
  lightning_address?: string;
  required_signatures?: number;
}

/**
 * Request to update a group wallet
 */
export interface UpdateGroupWalletRequest {
  name?: string;
  description?: string;
  purpose?: string;
  bitcoin_address?: string;
  lightning_address?: string;
  required_signatures?: number;
  is_active?: boolean;
}

// ==================== ACTIVITY TYPES ====================

export type ActivityType =
  | 'created_group'
  | 'updated_group'
  | 'joined_group'
  | 'left_group'
  | 'member_added'
  | 'member_removed'
  | 'role_changed'
  | 'created_wallet'
  | 'updated_wallet'
  | 'created_project'
  | 'created_proposal'
  | 'voted'
  | 'created_event'
  | 'updated_event'
  | 'deleted_event'
  | 'rsvp_to_event';

interface GroupActivity {
  id: string;
  group_id: string;
  user_id: string;
  activity_type: ActivityType;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GroupActivitiesResponse {
  success: boolean;
  activities?: GroupActivity[];
  total?: number;
  error?: string;
}

export interface GroupActivitiesQuery {
  activity_type?: ActivityType;
  user_id?: string;
  from_date?: string;
  to_date?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ==================== EVENT TYPES ====================

type EventType = 'general' | 'meeting' | 'celebration' | 'assembly';
type LocationType = 'online' | 'in_person' | 'hybrid';
export type RsvpStatus = 'going' | 'maybe' | 'not_going';

export interface GroupEvent {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  description?: string;
  event_type: EventType;
  location_type: LocationType;
  location_details?: string;
  starts_at: string;
  ends_at?: string;
  timezone: string;
  max_attendees?: number;
  is_public: boolean;
  requires_rsvp: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventRsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateEventInput {
  group_id: string;
  title: string;
  description?: string;
  event_type?: EventType;
  location_type?: LocationType;
  location_details?: string;
  starts_at: string;
  ends_at?: string;
  timezone?: string;
  max_attendees?: number;
  is_public?: boolean;
  requires_rsvp?: boolean;
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface EventsQuery {
  status?: 'upcoming' | 'past' | 'all';
  event_type?: EventType;
  limit?: number;
  offset?: number;
}

export interface EventResponse {
  success: boolean;
  event?: GroupEvent;
  error?: string;
}

export interface EventsListResponse {
  success: boolean;
  events?: GroupEvent[];
  total?: number;
  error?: string;
}

export interface RsvpResponse {
  success: boolean;
  rsvp?: EventRsvp;
  error?: string;
}

export interface RsvpsListResponse {
  success: boolean;
  rsvps?: EventRsvp[];
  total?: number;
  error?: string;
}
