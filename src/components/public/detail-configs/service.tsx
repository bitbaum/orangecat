import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import PriceDisplay from '@/components/public/PriceDisplay';
import { safeHrefs, hrefLabel } from '@/lib/security/safeHref';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';
import { BookEntityButton } from '@/components/bookings/BookEntityButton';
import { hasAvailability, formatAvailabilityLines } from '@/lib/availability';
import { formatDurationMinutes } from '@/utils/dates';
import { SERVICE_LOCATION_TYPES } from '@/config/services';

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
  createdLabel: 'Listed',
  descriptionTitle: 'About this Service',
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
  renderDetails: (entity, _payable, _isOwner, isSignedIn) => {
    const { amount, currency, perHour } = getServicePrice(entity);
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {amount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-fg-secondary">Price</span>
                <PriceDisplay
                  amount={amount}
                  currency={currency}
                  className="text-xl font-bold text-fg-primary text-right"
                  suffix={perHour ? ' / hr' : undefined}
                />
              </div>
            )}
            {durationMinutes && (
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
            {hasAvailability(entity.availability_schedule) && (
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
            <BookEntityButton
              className="w-full"
              isSignedIn={isSignedIn}
              bookableType="service"
              bookableId={entity.id as string}
              bookableTitle={(entity.title as string) || 'this service'}
              priceBtc={amount > 0 ? amount : undefined}
              priceCurrency={currency}
              durationMinutes={durationMinutes}
            />
          </CardContent>
        </Card>
      </>
    );
  },
};
