/**
 * Asset Entity Configuration - Single Source of Truth
 *
 * Display labels and colors for asset types, verification levels, and rental periods.
 * Components should import from here instead of defining inline.
 */

import { BADGE_COLORS } from './badge-colors';

// ==================== ASSET TYPES ====================

export const ASSET_TYPES = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'luxury', label: 'Luxury Item' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'computing', label: 'Computing' },
  { value: 'recreational', label: 'Recreational' },
  { value: 'robot', label: 'Robot / Automation' },
  { value: 'drone', label: 'Drone / UAV' },
  { value: 'business', label: 'Business' },
  { value: 'securities', label: 'Securities' },
  { value: 'other', label: 'Other' },
] as const;

export type AssetType = (typeof ASSET_TYPES)[number]['value'];

export const isAssetType = (value: unknown): value is AssetType =>
  typeof value === 'string' && ASSET_TYPES.some(t => t.value === value);

// ==================== VERIFICATION LEVELS ====================

export const VERIFICATION_LEVELS = [
  {
    value: 'third_party_verified',
    label: 'Third-Party Verified',
    badgeColor: BADGE_COLORS.success,
  },
  { value: 'user_provided', label: 'Self-Verified', badgeColor: BADGE_COLORS.warning },
  { value: 'unverified', label: 'Unverified', badgeColor: BADGE_COLORS.neutral },
] as const;

export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number]['value'];

// ==================== RENTAL PERIODS ====================

export const RENTAL_PERIODS = [
  { value: 'hourly', label: 'Per Hour' },
  { value: 'daily', label: 'Per Day' },
  { value: 'weekly', label: 'Per Week' },
  { value: 'monthly', label: 'Per Month' },
] as const;

export type RentalPeriod = (typeof RENTAL_PERIODS)[number]['value'];

// ==================== DERIVED LOOKUP MAPS ====================

export const ASSET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_TYPES.map(t => [t.value, t.label])
);

export const ASSET_VERIFICATION_COLORS: Record<string, string> = Object.fromEntries(
  VERIFICATION_LEVELS.map(v => [v.value, v.badgeColor])
);

export const ASSET_VERIFICATION_LABELS: Record<string, string> = Object.fromEntries(
  VERIFICATION_LEVELS.map(v => [v.value, v.label])
);

export const ASSET_RENTAL_PERIOD_LABELS: Record<string, string> = Object.fromEntries(
  RENTAL_PERIODS.map(r => [r.value, r.label])
);
