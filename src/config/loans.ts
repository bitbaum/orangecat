/**
 * Loan Entity Configuration - Single Source of Truth
 *
 * Display labels for loan categories and fulfillment types.
 * Components should import from here instead of defining inline.
 */

import type { LucideIcon } from 'lucide-react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { LOAN_OFFER_TYPES as LOAN_OFFER_TYPE_VALUES } from '@/config/loan-offers';

// ==================== LOAN CATEGORIES ====================

export const LOAN_CATEGORIES = [
  { value: 'personal', label: 'Personal Loan' },
  { value: 'business', label: 'Business Loan' },
  { value: 'education', label: 'Education Loan' },
  { value: 'home_improvement', label: 'Home Improvement' },
  { value: 'debt_consolidation', label: 'Debt Consolidation' },
  { value: 'emergency', label: 'Emergency Loan' },
  { value: 'other', label: 'Other' },
] as const;

export type LoanCategory = (typeof LOAN_CATEGORIES)[number]['value'];

// ==================== FULFILLMENT TYPES ====================

export const LOAN_FULFILLMENT_TYPES = [
  { value: 'manual', label: 'Manual Repayment' },
  { value: 'automatic', label: 'Automatic Deduction' },
] as const;

export type LoanFulfillmentType = (typeof LOAN_FULFILLMENT_TYPES)[number]['value'];

// ==================== LOAN TYPES ====================

export const LOAN_TYPES = [
  {
    value: 'new_request',
    label: 'Request New Loan',
    description: 'I need funding and want to find lenders',
  },
  {
    value: 'existing_refinance',
    label: 'Refinance Existing Loan',
    description: 'I have an existing loan and want better terms',
  },
] as const;

export type LoanType = (typeof LOAN_TYPES)[number]['value'];

// ==================== OFFER TYPES ====================
// Raw values are the SSOT in config/loan-offers.ts (used by the Zod enums).
// Here we attach display labels for the UI, derived from that tuple so the two
// never drift.

export type LoanOfferType = (typeof LOAN_OFFER_TYPE_VALUES)[number];

export const LOAN_OFFER_TYPE_LABELS: Record<LoanOfferType, string> = {
  refinance: 'Refinance - Lower rate, better terms',
  payoff: 'Payoff - Pay off the loan completely',
};

export const LOAN_OFFER_TYPE_OPTIONS: ReadonlyArray<{ value: LoanOfferType; label: string }> =
  LOAN_OFFER_TYPE_VALUES.map(value => ({ value, label: LOAN_OFFER_TYPE_LABELS[value] }));

// ==================== DERIVED LOOKUP MAPS ====================

export const LOAN_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  LOAN_CATEGORIES.map(c => [c.value, c.label])
);

// ==================== STATUS BADGE COLORS ====================
// Centralised here so components don't scatter status→color logic

import { BADGE_COLORS } from '@/config/badge-colors';
import { STATUS } from '@/config/database-constants';

export const LOAN_OFFER_STATUS_COLORS: Record<string, string> = {
  [STATUS.LOAN_OFFERS.PENDING]: BADGE_COLORS.warning,
  [STATUS.LOAN_OFFERS.ACCEPTED]: BADGE_COLORS.success,
  [STATUS.LOAN_OFFERS.REJECTED]: BADGE_COLORS.error,
  [STATUS.LOAN_OFFERS.EXPIRED]: BADGE_COLORS.neutral,
};

export const getLoanOfferStatusColor = (status: string): string =>
  LOAN_OFFER_STATUS_COLORS[status] ?? BADGE_COLORS.neutral;

// ==================== STATUS ICONS ====================
// Shared status→icon mapping so offer components don't each redefine it.

export const LOAN_OFFER_STATUS_ICONS: Record<string, LucideIcon> = {
  [STATUS.LOAN_OFFERS.PENDING]: Clock,
  [STATUS.LOAN_OFFERS.ACCEPTED]: CheckCircle,
  [STATUS.LOAN_OFFERS.REJECTED]: XCircle,
  [STATUS.LOAN_OFFERS.EXPIRED]: Clock,
};

export const getLoanOfferStatusIcon = (status: string): LucideIcon =>
  LOAN_OFFER_STATUS_ICONS[status] ?? Clock;
