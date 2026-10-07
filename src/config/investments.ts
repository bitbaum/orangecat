/**
 * Investment Entity Configuration - Single Source of Truth
 *
 * Display labels and colors for investment types and risk levels.
 * Components should import from here instead of defining inline.
 */

import { BADGE_COLORS } from './badge-colors';
import { STATUS } from './database-constants';

/** The statuses in which an investment is publicly visible (list, page, capital rail). */
export const INVESTMENT_PUBLIC_STATUSES = [
  STATUS.INVESTMENTS.OPEN,
  STATUS.INVESTMENTS.FUNDED,
  STATUS.INVESTMENTS.ACTIVE,
] as const;

// ==================== INVESTMENT TYPES ====================

export const INVESTMENT_TYPES = [
  { value: 'equity', label: 'Equity' },
  { value: 'revenue_share', label: 'Revenue Share' },
  { value: 'profit_share', label: 'Profit Share' },
  { value: 'token', label: 'Token' },
  { value: 'other', label: 'Other' },
] as const;

export type InvestmentType = (typeof INVESTMENT_TYPES)[number]['value'];

// ==================== RISK LEVELS ====================

export const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', badgeColor: BADGE_COLORS.success },
  { value: 'medium', label: 'Medium Risk', badgeColor: BADGE_COLORS.warning },
  { value: 'high', label: 'High Risk', badgeColor: BADGE_COLORS.error },
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number]['value'];

// ==================== RETURN FREQUENCIES ====================

export const RETURN_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'at_exit', label: 'At Exit' },
  { value: 'custom', label: 'Custom' },
] as const;

export type ReturnFrequency = (typeof RETURN_FREQUENCIES)[number]['value'];

// ==================== DERIVED LOOKUP MAPS ====================

export const INVESTMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  INVESTMENT_TYPES.map(t => [t.value, t.label])
);

export const INVESTMENT_RISK_COLORS: Record<string, string> = Object.fromEntries(
  RISK_LEVELS.map(r => [r.value, r.badgeColor])
);

export const RETURN_FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(
  RETURN_FREQUENCIES.map(f => [f.value, f.label])
);
