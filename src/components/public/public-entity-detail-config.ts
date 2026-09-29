/**
 * Config + types for the generic public entity detail page. Extracted from
 * PublicEntityDetailPage.tsx to keep that component under 300 lines. This is
 * the SSOT for what each entity's detail page is *configured* with; the page
 * component consumes it. Re-exported from PublicEntityDetailPage for
 * back-compat with existing importers.
 */
import { createServerClient } from '@/lib/supabase/server';
import { getTableName, type EntityType } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import type { ReactNode } from 'react';

// Color theme → semantic class mapping. The four colorTheme values in
// ENTITY_REGISTRY now all resolve to the same neutral chrome — the
// rebrand commits to monochromatic surfaces, status colors only for
// actual status. Anything that wants a chromatic accent should opt in
// via renderHeaderIcon, not the global icon-box theme.
const NEUTRAL_THEME = { bg: 'bg-surface-raised', icon: 'text-fg-primary', text: 'text-fg-primary' };

export const THEME_CLASSES: Record<string, { bg: string; icon: string; text: string }> = {
  tiffany: NEUTRAL_THEME,
  rose: NEUTRAL_THEME,
  orange: NEUTRAL_THEME,
  green: NEUTRAL_THEME,
};

export const PAGE_SURFACE_CLASSES: Record<string, string> = {
  tiffany: 'bg-surface-page',
  rose: 'bg-surface-page',
  orange: 'bg-surface-page',
  green: 'bg-surface-page',
};

export type EntityData = Record<string, any>;

export interface EntityDetailConfig {
  entityType: EntityType;
  /** Label for the owner card (e.g., "Seller", "Provider", "Organizer") */
  ownerLabel?: string;
  /** Label for the timestamps card (e.g., "Listed") */
  createdLabel?: string;
  /** Description card title (e.g., "About this Service") */
  descriptionTitle?: string;
  /** Back link text override */
  backText?: string;
  /** Back link href override */
  backHref?: string;
  /** Extra JSON-LD properties derived from entity data */
  getJsonLdExtra?: (entity: EntityData) => Record<string, unknown>;
  /** Override the themed icon box in the header (e.g., a cover image) */
  renderHeaderIcon?: (entity: EntityData) => ReactNode;
  /**
   * Ordered cover image URLs (cover first) for the full-width hero, rendered
   * below the header. Return [] for entities with no imagery — the page then
   * falls back to the header type icon. Drives PublicEntityHero.
   */
  getCoverImages?: (entity: EntityData) => string[];
  /** Header badges/extra info (e.g., date for events, category for products) */
  renderHeaderExtra?: (entity: EntityData) => ReactNode;
  /** Entity-specific detail cards below description */
  /**
   * `payable` is true when the seller has a connected wallet — gate pay CTAs on it.
   * `isOwner` is true when the viewer owns this entity — render management
   * affordances (e.g. add/edit sub-items) instead of the read-only view.
   */
  renderDetails?: (
    entity: EntityData,
    payable: boolean,
    isOwner: boolean,
    isSignedIn: boolean,
  ) => ReactNode;
  /**
   * Resolve the entity's price for the payment section, in its OWN currency
   * (NOT BTC — there is no price_btc column). Returns null when the entity has
   * no fixed price (e.g. contribution entities). The buyer is charged the
   * BTC-converted amount server-side; this only drives display.
   */
  getPrice?: (entity: EntityData) => { amount: number; currency: string } | null;
  /** Extra sidebar cards rendered after EntityShare (e.g., Quick Stats, CTAs) */
  renderSidebarExtra?: (entity: EntityData) => ReactNode;
  /** Select columns for metadata query (defaults to 'title, description, price_btc') */
  metadataSelect?: string;
  /** View route for sign-in redirect */
  getViewRoute?: (id: string) => string;
  /** Override default visibility filter. Defaults to `status = active`. */
  visibilityFilter?: { column: string; value: string | boolean };
  /** Whether to show the payment section in the sidebar (default: true) */
  showPaymentSection?: boolean;
  /**
   * Mobile-only sticky bottom CTA. On <md the page renders a fixed
   * bottom bar so the primary visitor action is one tap from any scroll
   * position. When omitted: defaults to a "Support" button anchored to
   * the payment section (suppressed when showPaymentSection is false).
   * Pass an entity-aware getter for actions that depend on entity data
   * (e.g. loans → /auth?from=/loans/:id). Returning null suppresses
   * the bar entirely.
   */
  mobileStickyCTA?:
    | { label: string; href: string }
    | ((entity: EntityData) => { label: string; href: string } | null)
    | null;
}

/**
 * Fetch entity data for metadata generation
 */
export async function fetchEntityForMetadata(
  entityType: EntityType,
  id: string,
  select?: string,
  visibilityFilter?: { column: string; value: string | boolean }
) {
  const supabase = await createServerClient();
  const filterCol = visibilityFilter?.column ?? 'status';
  const filterVal = visibilityFilter?.value ?? STATUS.PRODUCTS.ACTIVE;
  const { data } = await supabase
    .from(getTableName(entityType))
    .select(select || 'title, description')
    .eq('id', id)
    .eq(filterCol, filterVal)
    .single();
  return data as EntityData | null;
}
