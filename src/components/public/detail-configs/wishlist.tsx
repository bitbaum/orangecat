/**
 * Wishlist detail config — SSOT for BOTH the public page and the owner
 * dashboard page. A wishlist is a container of independently-funded items, so
 * its `renderDetails` renders the item list rather than a single primary CTA.
 *
 * Owner-aware: when the viewer owns the wishlist, items link to their edit
 * route and an "Add Item" affordance appears; visitors see the same items
 * read-only. Both routes pass the same fetched `items` into this builder so the
 * layout, funding math, and copy live in one place.
 */

import Image from 'next/image';
import { safeHref } from '@/lib/security/safeHref';
import Link from 'next/link';
import { Gift, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import FundingProgress from '@/components/public/FundingProgress';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WISHLIST_TYPE_LABELS } from '@/config/wishlists';
import { displayBTC } from '@/services/currency/formatting';
import type { EntityDetailConfig } from '@/components/public/public-entity-detail-config';
import { APP_LOCALE } from '@/utils/locale';

/** The item shape both routes fetch (owner-only fields are optional). */
export interface WishlistDetailItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_amount_btc: number;
  funded_amount_btc: number;
  is_fully_funded: boolean;
  external_url: string | null;
  priority: number;
  is_fulfilled?: boolean;
  created_at?: string;
  quantity_wanted?: number | null;
  allow_partial_funding?: boolean | null;
}

/**
 * Columns both the public and owner pages select — keep them in sync via this SSOT.
 *
 * `quantity_wanted` and `allow_partial_funding` were collected by the item form
 * and displayed nowhere, and the reason was here: an explicit allow-list that
 * never asked for them. A field cannot render if the query does not select it,
 * and a narrow optional type hides that from the compiler — so widening the
 * interface without widening this string would have changed nothing.
 */
export const WISHLIST_ITEM_COLUMNS =
  'id, title, description, image_url, target_amount_btc, funded_amount_btc, is_fully_funded, is_fulfilled, external_url, priority, created_at, quantity_wanted, allow_partial_funding';

const WISHLIST_BASE_PATH = ENTITY_REGISTRY['wishlist'].basePath;

function ItemProgress({ item }: { item: WishlistDetailItem }) {
  if (!(item.target_amount_btc > 0)) {
    return null;
  }
  const funded = item.funded_amount_btc ?? 0;
  const pct = Math.round((funded / item.target_amount_btc) * 100);
  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between text-xs text-fg-secondary">
        <span>{displayBTC(funded)}</span>
        <span>{displayBTC(item.target_amount_btc)} goal</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function ItemBody({ item }: { item: WishlistDetailItem }) {
  return (
    <div className="flex gap-4">
      {item.image_url ? (
        <Image
          src={item.image_url}
          alt={item.title}
          width={64}
          height={64}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-16 h-16 bg-surface-raised rounded-lg flex items-center justify-center flex-shrink-0">
          <Gift className="w-6 h-6 text-fg-tertiary dark:text-fg-secondary/50" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-fg-primary">{item.title}</h3>
          <div className="flex gap-1 flex-shrink-0">
            {item.is_fulfilled && (
              <Badge variant="secondary" className="text-xs">
                Fulfilled
              </Badge>
            )}
            {item.is_fully_funded && !item.is_fulfilled && (
              <Badge className="bg-status-positive text-xs">Funded</Badge>
            )}
            {/* Only the non-default values are worth pixels: quantity 1 and
                partial-funding-allowed are the defaults, so badging them on
                every item would be noise a giver has to read past. */}
            {typeof item.quantity_wanted === 'number' && item.quantity_wanted > 1 && (
              <Badge variant="secondary" className="text-xs">
                Wants {item.quantity_wanted}
              </Badge>
            )}
            {item.allow_partial_funding === false && (
              <Badge variant="secondary" className="text-xs">
                Full amount only
              </Badge>
            )}
          </div>
        </div>
        {item.description && (
          <p className="text-sm text-fg-secondary mt-1 line-clamp-2">{item.description}</p>
        )}
        {/* Never render item.external_url directly: it is owner-supplied and
            older rows predate the http(s)-only schema, so a `javascript:` value
            here would execute in a visitor's session on click. */}
        {safeHref(item.external_url) && (
          <a
            href={safeHref(item.external_url) as string}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-fg-primary hover:underline mt-1 inline-block"
          >
            View item →
          </a>
        )}
        <ItemProgress item={item} />
      </div>
    </div>
  );
}

/**
 * Build the wishlist detail config from its already-fetched items.
 * @param items funded items (any order; sorting is the caller's concern)
 */
export function buildWishlistDetailConfig(items: WishlistDetailItem[]): EntityDetailConfig {
  const totalTarget = items.reduce((sum, i) => sum + (i.target_amount_btc || 0), 0);
  const totalFunded = items.reduce((sum, i) => sum + (i.funded_amount_btc || 0), 0);

  return {
    entityType: 'wishlist',
    ownerLabel: 'Created by',
    descriptionTitle: 'About this Wishlist',
    visibilityFilter: { column: 'is_active', value: true },
    metadataSelect: 'title, description, cover_image_url',
    getJsonLdExtra: entity => ({
      ...(entity.event_date ? { eventDate: entity.event_date } : {}),
      numberOfItems: items.length,
    }),
    renderHeaderIcon: entity =>
      entity.cover_image_url ? (
        <Image
          src={entity.cover_image_url as string}
          alt={entity.title}
          width={64}
          height={64}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-16 h-16 bg-surface-raised rounded-lg flex items-center justify-center flex-shrink-0">
          <Gift className="w-8 h-8 text-fg-primary" />
        </div>
      ),
    renderHeaderExtra: entity => (
      <>
        <Badge variant="secondary" className="capitalize">
          {WISHLIST_TYPE_LABELS[entity.type as string] || (entity.type as string)}
        </Badge>
        {entity.event_date && (
          <span className="text-sm text-fg-secondary">
            {new Date(entity.event_date as string).toLocaleDateString(APP_LOCALE, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
      </>
    ),
    renderDetails: (entity, _payable, isOwner) => (
      <>
        {items.length > 0 && (
          <FundingProgress
            title="Overall Progress"
            raised={totalFunded}
            goal={totalTarget}
            currency="BTC"
            raisedLabel="funded"
            goalLabel="total"
            hideWhenEmpty
          />
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-fg-primary">
              Items{items.length > 0 && ` (${items.length})`}
            </h2>
            {isOwner && (
              <Link href={`${WISHLIST_BASE_PATH}/items/new?wishlist_id=${entity.id}`}>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </Link>
            )}
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-fg-secondary">
                <Gift className="w-8 h-8 mx-auto mb-2 text-fg-tertiary dark:text-fg-secondary/50" />
                <p className="mb-3">No items in this wishlist yet.</p>
                {isOwner && (
                  <Link href={`${WISHLIST_BASE_PATH}/items/new?wishlist_id=${entity.id}`}>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add First Item
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {items.map(item =>
                isOwner ? (
                  // Owner: the whole card links to the item's edit route.
                  <Link
                    key={item.id}
                    href={`${WISHLIST_BASE_PATH}/items/${item.id}`}
                    className="block"
                  >
                    <Card className={`oc-card-link ${item.is_fulfilled ? 'opacity-60' : ''}`}>
                      <CardContent className="p-4">
                        <ItemBody item={item} />
                      </CardContent>
                    </Card>
                  </Link>
                ) : (
                  <Card key={item.id} className={item.is_fully_funded ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <ItemBody item={item} />
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}
        </div>
      </>
    ),
  };
}
