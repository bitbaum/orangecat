/**
 * Browser client for the civic split — one person's declaration and the
 * public aggregate for a place.
 */
import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';
import type { CivicSplitInput } from '@/domain/civic-split/schema';
import type { CivicSplit, PlaceAggregate } from '@/domain/civic-split/service';
import type { LocalFund, PlaceRef } from '@/domain/local-fund/service';

export type { CivicSplit, CivicSplitInput, PlaceAggregate };

export async function fetchMyCivicSplit(): Promise<CivicSplit | null> {
  const res = await fetch(API_ROUTES.CIVIC_SPLIT.BASE);
  const { split } = await unwrapApiResponse<{ split: CivicSplit | null }>(
    res,
    'Could not load your split.'
  );
  return split;
}

export async function saveMyCivicSplit(input: CivicSplitInput): Promise<CivicSplit> {
  const res = await fetch(API_ROUTES.CIVIC_SPLIT.BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const { split } = await unwrapApiResponse<{ split: CivicSplit }>(
    res,
    'Could not save your split.'
  );
  return split;
}

export async function withdrawMyCivicSplit(): Promise<void> {
  const res = await fetch(API_ROUTES.CIVIC_SPLIT.BASE, { method: 'DELETE' });
  await unwrapApiResponse<{ split: null }>(res, 'Could not withdraw your split.');
}

export interface PlaceAggregateResponse {
  country_code: string;
  region: string | null;
  min_group: number;
  places: PlaceAggregate[];
}

export async function fetchPlaceAggregate(
  countryCode: string,
  region?: string
): Promise<PlaceAggregateResponse> {
  const params = new URLSearchParams({ country: countryCode });
  if (region) {
    params.set('region', region);
  }
  const res = await fetch(`${API_ROUTES.CIVIC_SPLIT.AGGREGATE}?${params}`);
  return unwrapApiResponse<PlaceAggregateResponse>(
    res,
    'Could not load the numbers for that place.'
  );
}

export interface LocalFundAnswer {
  place: PlaceRef;
  fund: LocalFund | null;
  /** Where to start one, set only when there is none. */
  start_href: string | null;
}

export async function fetchLocalFund(place: PlaceRef): Promise<LocalFundAnswer> {
  const params = new URLSearchParams({
    country: place.country_code,
    region: place.region,
    locality: place.locality,
  });
  const res = await fetch(`${API_ROUTES.CIVIC_SPLIT.FUND}?${params}`);
  return unwrapApiResponse<LocalFundAnswer>(res, 'Could not look up the fund for that place.');
}
