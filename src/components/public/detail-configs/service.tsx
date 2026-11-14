import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import PriceDisplay from '@/components/public/PriceDisplay';
import { safeHrefs, hrefLabel } from '@/lib/security/safeHref';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ownerOnlyStatus } from '@/components/public/public-entity-detail-config';
import { ROUTES } from '@/config/routes';
import { BookEntityButton } from '@/components/bookings/BookEntityButton';
import { serviceBookingShape } from '@/domain/bookings/shape';
import { hasAvailability, formatAvailabilityLines } from '@/lib/availability';
import { formatDurationMinutes } from '@/utils/dates';
import { SERVICE_LOCATION_TYPES } from '@/config/services';
import { getEntityPrimaryCta } from '@/config/entity-cta';
import { PAY_AFTER_ACCEPT_LINE } from '@/config/payment-flow';

/** Label for a stored location-type value, from the config SSOT. */
const locationTypeLabel = (value: unknown): string | null =>
  SERVICE_LOCATION_TYPES.find(t => t.value === value)?.label ?? null;

// user_services stores its price in `fixed_price` (or `hourly_rate`) in the entity's
// chosen `currency` — NOT price_btc (no such column) and NOT in BTC. Read the real
// column + currency and format in that currency. See decision_currency_convention.
const getServicePrice = (entity: Record<string, unknown>) => {
  const fixed = entity.fixed_price;
  const hourly = entity.hourly_rate;
  const raw = typeof fixed === 'number' && fixed > 0 ? fixed : hourly;
  const amount = typeof raw === 'number' ? raw : Number(raw ?? NaN);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: (entity.currency as string) || 'CHF',
    perHour: !(typeof fixed === 'number' && fixed > 0) && typeof hourly === 'number' && hourly > 0,
  };
};

/** SSOT for the service detail page — shared by the public + owner dashboard routes. */
export const serviceDetailConfig: EntityDetailConfig = {
  entityType: 'service',
  ownerLabel: 'Provider',
  statusBadge: ownerOnlyStatus,
  createdLabel: 'Listed',
  getViewRoute: id => ROUTES.SERVICES.VIEW(id),
  getCoverImages: entity =>
    (Array.isArray(entity.images) ? (entity.images as string[]) : []).filter(Boolean),
  getPrice: entity => {
    const { amount, currency } = getServicePrice(entity);
    return amount > 0 ? { amount, currency } : null;
  },
  getJsonLdExtra: entity => {
    const { amount, currency } = getServicePrice(entity);
    return {
      ...(amount > 0 && {
        offers: { '@type': 'Offer', priceCurrency: currency, price: amount },
      }),
      ...(entity.duration_minutes && { duration: `PT${entity.duration_minutes}M` }),
    };
  },
  // The phone's sticky bar leads to the Book button, where the booking is made —
  // not to the pay panel (#pay), which is a different action under the same label.
  mobileStickyCTA: { href: '#book', label: getEntityPrimaryCta('service') },
  // Price and the one action lead the page, where a phone's first screen reaches;
  // they used to sit in a Details card under the description.
  renderLead: (entity, _isOwner, isSignedIn) => {
    const { amount, currency, perHour } = getServicePrice(entity);
    return (
      <Card id="book" className="scroll-mt-24">
        <CardContent className="flex flex-col gap-4 pt-6">
          {amount > 0 && (
            <PriceDisplay
              amount={amount}
              currency={currency}
              className="text-3xl font-bold text-fg-primary"
              suffix={perHour ? ' / hr' : undefined}
            />
          )}
          <BookEntityButton
            className="w-full"
            isSignedIn={isSignedIn}
            bookableType="service"
            bookableId={entity.id as string}
            bookableTitle={(entity.title as string) || 'this service'}
            priceBtc={amount > 0 ? amount : undefined}
            priceCurrency={currency}
            shape={serviceBookingShape(entity)}
          />
          {/* Booked first, paid on acceptance: the page has no separate "pay". */}
          {amount > 0 && (
            <p className="mb-0 text-center text-xs text-fg-tertiary">{PAY_AFTER_ACCEPT_LINE}</p>
          )}
        </CardContent>
      </Card>
    );
  },
  renderDetails: entity => {
    const durationMinutes = (entity as { duration_minutes?: number }).duration_minutes;
    // Provider-supplied, so filtered rather than trusted — see safeHref. Rows
    // written before the http(s)-only schema can still hold anything.
    const portfolio = safeHrefs(entity.portfolio_links);
    // Whether a service is remote or on-site, and how far the provider travels,
    // decides whether a buyer can use it at all. Both were collected and shown
    // nowhere, so every listing read as if location were irrelevant.
    const locationType = locationTypeLabel(entity.service_location_type);
    const serviceArea =
      typeof entity.service_area === 'string' && entity.service_area.trim()
        ? entity.service_area.trim()
        : null;
    const hasAvailabilityLines = hasAvailability(entity.availability_schedule);
    // The price and the Book button moved to the lead; with none of the rest
    // this card would be a heading over nothing.
    const hasDetails = !!(durationMinutes || locationType || serviceArea || hasAvailabilityLines);
    return (
      <>
        {portfolio.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Previous work</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {portfolio.map(url => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-2 text-fg-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0 text-fg-secondary" />
                      <span className="break-all">{hrefLabel(url)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {hasDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!!durationMinutes && (
                <div className="flex items-center justify-between">
                  <span className="text-fg-secondary">Duration</span>
                  <span className="font-medium">{formatDurationMinutes(durationMinutes)}</span>
                </div>
              )}
              {locationType && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-fg-secondary">Delivery</span>
                  <span className="font-medium text-right">{locationType}</span>
                </div>
              )}
              {serviceArea && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-fg-secondary">Service area</span>
                  <span className="font-medium text-right break-words">{serviceArea}</span>
                </div>
              )}
              {hasAvailabilityLines && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-fg-secondary">Availability</span>
                  <div className="text-right">
                    {formatAvailabilityLines(entity.availability_schedule).map(line => (
                      <div key={line} className="font-medium text-fg-primary">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </>
    );
  },
};
