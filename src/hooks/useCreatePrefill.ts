/**
 * USE CREATE PREFILL HOOK
 *
 * Shared hook for entity creation prefill logic.
 * Handles prefill from URL params (priority) and localStorage (fallback).
 *
 * Created: 2026-01-28
 * Last Modified: 2026-01-28
 * Last Modified Summary: Initial creation - DRY extraction from 3 create pages
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';
import { STORAGE_KEYS } from '@/config/storage-keys';
import type { EntityType } from '@/config/entity-registry';

/**
 * Base fields that can be prefilled from URL params.
 * Includes financial fields for entity-specific prefill from Cat actions.
 */
interface BasePrefillFields {
  title?: string;
  description?: string;
  category?: string;
  // Display price: the amount + currency the user actually sees/enters (e.g. 45 CHF).
  // The product/service forms use `price` (in the selected `currency`), NOT price_btc —
  // so a Cat draft that only set price_btc left the Price field at 0. Map the display
  // pair onto the real form fields.
  price?: number;
  currency?: string;
  // Numeric fields (all parsed as float to preserve BTC decimals)
  price_btc?: number;
  goal_amount?: number;
  hourly_rate?: number;
  fixed_price?: number;
  original_amount?: number; // loan
  interest_rate?: number; // loan (percentage)
  target_amount?: number; // investment
  minimum_investment?: number; // investment
  funding_goal_btc?: number; // research
  // String fields
  goal_deadline?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  event_date?: string; // wishlist
  name?: string;
  label?: string;
  field?: string;
  type?: string;
  loan_type?: string;
  cause_category?: string;
  investment_type?: string; // investment
  methodology?: string; // research
  visibility?: string; // wishlist
  product_type?: string; // product
  fulfillment_type?: string; // product
}

interface UseCreatePrefillOptions {
  /** Entity type for localStorage key */
  entityType: EntityType;
  /** Whether the hook is ready to run (e.g., user is authenticated) */
  enabled?: boolean;
}

interface UseCreatePrefillReturn<T extends Record<string, unknown>> {
  /** Initial data from prefill sources */
  initialData: Partial<T> | undefined;
  /** Whether prefill has been loaded */
  isLoaded: boolean;
}

/**
 * Hook that handles prefill data for entity creation pages.
 *
 * Priority:
 * 1. URL params (title, description, category)
 * 2. localStorage (entity-specific prefill key)
 *
 * localStorage is automatically cleared after reading.
 *
 * @example
 * const { initialData, isLoaded } = useCreatePrefill<ProjectData>({
 *   entityType: 'project',
 *   enabled: isAuthenticated,
 * });
 */
/**
 * Pure: build prefill data from URL params. Synchronous — the params are
 * available on first render, so callers can `useMemo` this and avoid the
 * one-render delay that left wizard forms blank when Cat handed off a draft.
 * Returns undefined when no recognizable prefill params are present.
 */
function buildUrlPrefill<T extends Record<string, unknown>>(
  searchParams: ReadonlyURLSearchParams | null
): Partial<T> | undefined {
  const title = searchParams?.get('title');
  const description = searchParams?.get('description');
  const category = searchParams?.get('category');
  const name = searchParams?.get('name');

  if (!(title || description || name)) {
    return undefined;
  }

  const prefillData: BasePrefillFields = {};
  if (title) {
    prefillData.title = title;
  }
  if (description) {
    prefillData.description = description;
  }
  if (category) {
    prefillData.category = category;
  }
  if (name) {
    prefillData.name = name;
  }

  // Numeric fields — parseFloat (not parseInt) so BTC decimals survive.
  const numericFields = [
    'price_btc',
    'goal_amount',
    'hourly_rate',
    'fixed_price',
    'original_amount',
    'interest_rate', // loan
    'target_amount',
    'minimum_investment', // investment
    'funding_goal_btc', // research
  ] as const;
  for (const field of numericFields) {
    const val = searchParams?.get(field);
    if (val) {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        prefillData[field] = parsed;
      }
    }
  }
  // Display price pair → the form's actual `price` + `currency` fields.
  const priceDisplayAmount = searchParams?.get('price_display_amount');
  if (priceDisplayAmount) {
    const parsed = parseFloat(priceDisplayAmount);
    if (!isNaN(parsed)) {
      prefillData.price = parsed;
    }
  }
  const priceDisplayCurrency = searchParams?.get('price_display_currency');
  if (priceDisplayCurrency) {
    prefillData.currency = priceDisplayCurrency;
  }
  // A BTC price with no display pair is still a price: the product form has no
  // `price_btc` field, so it used to vanish and the form opened at 0.00.
  if (prefillData.price === undefined && typeof prefillData.price_btc === 'number') {
    prefillData.price = prefillData.price_btc;
    prefillData.currency = prefillData.currency ?? 'BTC';
  }

  const stringFields = [
    'goal_deadline',
    'location',
    'start_date',
    'end_date',
    'event_date',
    'label',
    'field',
    'type',
    'loan_type',
    'cause_category',
    'investment_type',
    'methodology',
    'visibility', // new entity types
    'product_type',
    'fulfillment_type', // product — silently dropped before, so "digital" opened as physical
  ] as const;
  for (const field of stringFields) {
    const val = searchParams?.get(field);
    if (val) {
      prefillData[field] = val;
    }
  }

  return prefillData as Partial<T>;
}

export function useCreatePrefill<T extends Record<string, unknown>>({
  entityType,
  enabled = true,
}: UseCreatePrefillOptions): UseCreatePrefillReturn<T> {
  const searchParams = useSearchParams();

  // URL params (from Cat action buttons, links). Computed SYNCHRONOUSLY so it's
  // present on the very first render — a create wizard that seeds its form state
  // with `useState(initialData)` on mount would otherwise capture `undefined`
  // (the old async useEffect resolved a render too late) and render a blank form
  // even though Cat passed a full draft.
  const urlData = useMemo(
    () => (enabled ? buildUrlPrefill<T>(searchParams) : undefined),
    [enabled, searchParams]
  );

  // localStorage fallback (legacy AI-chat prefill) — inherently a side effect
  // (read + clear), so it stays async. Only consulted when no URL prefill.
  const [lsData, setLsData] = useState<Partial<T> | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (urlData) {
      setIsLoaded(true);
      return;
    }
    try {
      const storageKey = STORAGE_KEYS.ENTITY_PREFILL(entityType);
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setLsData(JSON.parse(raw) as Partial<T>);
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, [enabled, urlData, entityType]);

  return {
    initialData: urlData ?? lsData,
    isLoaded,
  };
}
