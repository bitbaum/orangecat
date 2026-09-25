/**
 * Generic Public Entity Detail Page
 *
 * Renders any entity's public detail page using ENTITY_REGISTRY metadata.
 * Eliminates 95%+ duplication across products/[id], services/[id], causes/[id], events/[id].
 *
 * Each entity page becomes a thin wrapper that passes entityType + optional custom sections.
 */

import { notFound } from 'next/navigation';
import { Tag } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getTableName, getEntityMetadata } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { generateEntityJsonLd, JsonLdScript } from '@/lib/seo/structured-data';
import EntityShare from '@/components/sharing/EntityShare';
import PublicEntityOwnerCard from '@/components/public/PublicEntityOwnerCard';
import PublicEntityHero from '@/components/public/PublicEntityHero';
import { PublicEntityPaymentSection } from '@/components/payment';
import { resolveSellerReceiveInfo, type SellerReceiveInfo } from '@/domain/payments';
import { getSharedWalletUsage, type SharedWalletUsage } from '@/domain/wallets/walletUsage';
import { convertToBtcOrNull } from '@/services/currency/rates.server';
import { type CurrencyCode } from '@/config/currencies';
import { fetchEntityOwner } from '@/lib/entities/fetchEntityOwner';
import { fetchProfileListingCounts } from '@/services/profile/listingCounts';
import { type WalletVisibility } from '@/config/wallet-visibility';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { PublicEntityOwnerBar } from './PublicEntityOwnerBar';
import {
  THEME_CLASSES,
  PAGE_SURFACE_CLASSES,
  fetchEntityForMetadata,
  type EntityData,
  type EntityDetailConfig,
} from './public-entity-detail-config';
import { MobileStickyCTA } from './PublicEntityStickyCTA';
import LokiBuildCta from '@/components/integrations/LokiBuildCta';
import SolonGovernCta from '@/components/integrations/SolonGovernCta';

// Re-export config types + metadata helper for back-compat with the many
// entity page/config modules that import them from here.
export { fetchEntityForMetadata };
export type { EntityData, EntityDetailConfig };

/**
 * Main generic entity detail page component
 */
export default async function PublicEntityDetailPage({
  id,
  config,
}: {
  id: string;
  config: EntityDetailConfig;
}) {
  const meta = getEntityMetadata(config.entityType);
  const theme = THEME_CLASSES[meta.colorTheme] || THEME_CLASSES.tiffany;
  const pageSurface = PAGE_SURFACE_CLASSES[meta.colorTheme] || PAGE_SURFACE_CLASSES.tiffany;
  const Icon = meta.icon;

  const supabase = await createServerClient();
  const table = getTableName(config.entityType);
  const visibilityCol = config.visibilityFilter?.column ?? 'status';
  const visibilityVal = config.visibilityFilter?.value ?? STATUS.PRODUCTS.ACTIVE;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: publicData } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .eq(visibilityCol, visibilityVal)
    .single();

  let entity = publicData as EntityData | null;
  let isOwnerPreview = false;

  // Not publicly visible (e.g. a draft). Let the OWNER preview it — the dashboard
  // "View public page" link would otherwise hit a bare 404 for unpublished
  // entities. Verify ownership before showing; never leak a draft to anyone else.
  if (!entity && user) {
    const { data: ownData } = await supabase.from(table).select('*').eq('id', id).single();
    const candidate = ownData as EntityData | null;
    const candidateOwner = candidate ? await fetchEntityOwner(supabase, candidate) : null;
    if (candidate && candidateOwner?.user_id === user.id) {
      entity = candidate;
      isOwnerPreview = true;
    }
  }

  if (!entity) {
    notFound();
  }

  const owner = await fetchEntityOwner(supabase, entity);
  // Provider trust: how many things this person publicly offers. Head-only
  // count queries (see listingCounts.ts) — same filter shape as the profile
  // tabs, so the number matches what clicking through to the profile shows.
  const ownerListingCount = owner?.user_id
    ? (await fetchProfileListingCounts(supabase, owner.user_id)).total
    : 0;
  // The viewer owns this entity (published or draft) → show a manage bar. This is
  // also the owner's dashboard detail view: one layout, buyers see the listing,
  // the owner sees it + Edit (no separate flat-grid dashboard page).
  const isOwner = !!user && !!owner?.user_id && owner.user_id === user.id;

  // Owner-only funding transparency. The toggle governs a wallet the owner
  // explicitly tied to THIS entity (entity_wallets is an optional per-entity
  // override — see walletResolutionService). Without such a link, funding flows
  // to the owner's default wallet and there is nothing entity-scoped to control,
  // so we fetch it only for the owner and render the control only when it exists.
  let fundingLink: { walletId: string; visibility: WalletVisibility } | null = null;
  if (isOwner) {
    const { data: link } = await supabase
      .from(DATABASE_TABLES.ENTITY_WALLETS)
      .select('wallet_id, visibility')
      .eq('entity_type', config.entityType)
      .eq('entity_id', id)
      .eq('is_primary', true)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (link) {
      // supabase-js's deep select-type inference degrades to `never` for this
      // dynamic .from().select()…maybeSingle() chain against the large schema
      // (reproduced even selecting a single known column), so narrow explicitly.
      // The shape/types match entity_wallets — visibility is a real typed column.
      const row = link as { wallet_id: string; visibility: string };
      fundingLink = {
        walletId: row.wallet_id,
        visibility: row.visibility as WalletVisibility,
      };
    }
  }
  // SSOT edit convention: entities are edited via their create page in edit
  // mode (?edit=<id>) — see src/config/entities/*.tsx editPath. There is no
  // `${basePath}/${id}/edit` route for most entity types; linking it 404'd.
  const editHref = `${meta.createPath}?edit=${id}`;

  // Resolve the seller's public receiving info + BTC amount server-side so a
  // logged-out visitor can pay direct (permissionless) — no account, no gate.
  // Skipped for entities with no payment section (e.g. loans).
  const price = config.getPrice?.(entity) ?? null;
  const priceAmount = price && price.amount > 0 ? price.amount : undefined;
  let sellerReceive: SellerReceiveInfo | null = null;
  let sharedWalletUsage: SharedWalletUsage | null = null;
  let priceAmountBtc: number | undefined;
  const hasPaymentSurface = config.showPaymentSection !== false || meta.canReceiveSupport;
  if (hasPaymentSurface) {
    sellerReceive = await resolveSellerReceiveInfo(config.entityType, id);
    // Address-reuse disclosure — only worth resolving when an address will
    // actually be shown (NWC reveals no static address to link).
    if (sellerReceive?.address) {
      sharedWalletUsage = await getSharedWalletUsage(supabase, config.entityType, id);
    }
    if (priceAmount !== undefined && price) {
      priceAmountBtc =
        (price.currency || 'BTC') === 'BTC'
          ? priceAmount
          : ((await convertToBtcOrNull(priceAmount, price.currency as CurrencyCode)) ?? undefined);
    }
  }

  const jsonLd = generateEntityJsonLd({
    type: config.entityType,
    id,
    title: entity.title,
    description: entity.description,
    extra: config.getJsonLdExtra?.(entity) || {},
  });

  const viewRoute = config.getViewRoute ? config.getViewRoute(id) : `${meta.publicBasePath}/${id}`;

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <div className={`min-h-screen oc-mobile-action-stack-padding ${pageSurface}`}>
        {isOwner && (
          <PublicEntityOwnerBar
            isOwnerPreview={isOwnerPreview}
            entityName={meta.name}
            entityStatus={entity.status}
            editHref={editHref}
            fundingLink={fundingLink}
            entityType={config.entityType}
            entityId={id}
            entityTitle={entity.title}
          />
        )}
        <div className="bg-surface-base border-b border-default">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Breadcrumb
              items={[{ label: meta.namePlural, href: meta.publicBasePath || ROUTES.DISCOVER }]}
              className="mb-4"
            />
            <div className="flex items-start justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                {config.renderHeaderIcon?.(entity) ?? (
                  <div
                    className={`h-14 w-14 flex-shrink-0 ${theme.bg} rounded-lg flex items-center justify-center sm:h-16 sm:w-16`}
                  >
                    <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${theme.icon}`} />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="break-words text-2xl font-bold text-fg-primary sm:text-3xl">
                    {entity.title}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                    {entity.status && (
                      <Badge variant="default" className="capitalize">
                        {entity.status}
                      </Badge>
                    )}
                    {entity.category && (
                      <Badge variant="secondary">
                        <Tag className="w-3 h-3 mr-1" />
                        {entity.category}
                      </Badge>
                    )}
                    {config.renderHeaderExtra?.(entity)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(() => {
          const coverImages = config.getCoverImages?.(entity) ?? [];
          return coverImages.length > 0 ? (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
              <PublicEntityHero images={coverImages} title={entity.title} />
            </div>
          ) : null;
        })()}

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {entity.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {config.descriptionTitle || 'Description'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-fg-primary whitespace-pre-wrap">{entity.description}</p>
                  </CardContent>
                </Card>
              )}

              {config.renderDetails?.(entity, !!sellerReceive, isOwner, !!user)}
            </div>

            <div className="space-y-6">
              {owner && (
                <PublicEntityOwnerCard
                  owner={owner}
                  label={config.ownerLabel || 'Owner'}
                  activeListingCount={ownerListingCount}
                  inquiry={isOwner ? undefined : { title: entity.title, path: viewRoute }}
                />
              )}

              <EntityShare
                entityType={config.entityType}
                entityId={id}
                title={entity.title}
                description={entity.description}
              />

              {isOwner && config.entityType !== 'wallet' && config.entityType !== 'document' && (
                <LokiBuildCta
                  variant="card"
                  entityType={config.entityType}
                  entityId={id}
                  sourcePath={viewRoute}
                />
              )}

              {isOwner && config.entityType === 'investment' && (
                <SolonGovernCta
                  variant="card"
                  entityType={config.entityType}
                  entityId={id}
                  sourcePath={viewRoute}
                  title={entity.title}
                />
              )}

              {config.renderSidebarExtra?.(entity)}

              {hasPaymentSurface && (
                <div id="pay">
                  <PublicEntityPaymentSection
                    entityType={config.entityType}
                    entityId={id}
                    entityTitle={entity.title}
                    priceAmount={priceAmount}
                    priceCurrency={price?.currency}
                    sellerProfileId={owner?.id ?? null}
                    sellerUserId={owner?.user_id ?? null}
                    sellerReceive={sellerReceive}
                    sharedWalletUsage={sharedWalletUsage}
                    priceAmountBtc={priceAmountBtc}
                    signInRedirect={viewRoute}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile sticky bottom CTA — keeps the primary action one tap
            away from any scroll position. Hidden on >=md where the
            sidebar payment section is naturally visible. */}
        <MobileStickyCTA config={config} entity={entity} payable={!!sellerReceive} />
      </div>
    </>
  );
}
