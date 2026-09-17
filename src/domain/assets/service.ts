import { createEntity, withResolvedActor } from '@/domain/base/entityService';
import type { AssetFormData } from './schema';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { STATUS } from '@/config/database-constants';

const ASSET_SELECT =
  'id, title, type, status, estimated_value, currency, created_at, verification_status';

export async function createAsset(userId: string, input: AssetFormData) {
  return createEntity(
    'asset',
    userId,
    withResolvedActor(input, {
      owner_id: userId,
      type: input.type,
      title: input.title,
      description: input.description || null,
      location: input.location || null,
      estimated_value: input.estimated_value ?? null,
      currency: input.currency ?? PLATFORM_DEFAULT_CURRENCY,
      documents: input.documents ?? null,
      // Sale / rental / deposit config — previously omitted here, so an asset
      // listed "for sale/rent" in the form saved none of it. Persist it.
      is_for_sale: input.is_for_sale ?? false,
      sale_price_btc: input.sale_price_btc ?? null,
      is_for_rent: input.is_for_rent ?? false,
      rental_price_btc: input.rental_price_btc ?? null,
      rental_period_type: input.rental_period_type ?? 'daily',
      min_rental_period: input.min_rental_period ?? 1,
      max_rental_period: input.max_rental_period ?? null,
      requires_deposit: input.requires_deposit ?? false,
      deposit_amount_btc: input.deposit_amount_btc ?? null,
      verification_status: 'unverified' as const,
      // Offered for rent or sale = listed. A draft nobody can find is not a listing.
      status: input.is_for_sale || input.is_for_rent ? STATUS.ASSETS.ACTIVE : STATUS.ASSETS.DRAFT,
      public_visibility: Boolean(input.is_for_sale || input.is_for_rent),
      // Respect the form's profile-visibility toggle; the schema already carries
      // it but this insert omitted it → DB default true always won.
      show_on_profile: input.show_on_profile ?? true,
    }),
    {
      select: ASSET_SELECT,
    }
  );
}
