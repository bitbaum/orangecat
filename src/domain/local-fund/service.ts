/**
 * The local fund of a place — the organisation the civic split routes to.
 *
 * A local fund is a group of kind `local_fund` bound to a place (country,
 * region, locality). The civic split declares what share of a person's
 * voluntary giving belongs to their locality; this finds the body that share
 * goes to, by the same lower(btrim()) keys both tables store. One per place is
 * the intent; when there are several, the oldest public one is the fund.
 */
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { placeKey } from '@/domain/civic-split/schema';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { COLLECTIVE_KINDS } from '@bitbaum/collective-kinds';

export interface PlaceRef {
  country_code: string;
  region: string;
  locality: string;
}

export interface LocalFund {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Where to open it: the public group page. */
  href: string;
  /** How it takes money, when it has said. */
  lightning_address: string | null;
  bitcoin_address: string | null;
}

const LOCAL_FUND_KIND = COLLECTIVE_KINDS.local_fund.id;

interface FundRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  lightning_address: string | null;
  bitcoin_address: string | null;
}

/** Pure: a row shaped for the screen. */
export function toLocalFund(row: FundRow): LocalFund {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    href: `${ENTITY_REGISTRY.group.publicBasePath}/${row.slug}`,
    lightning_address: row.lightning_address,
    bitcoin_address: row.bitcoin_address,
  };
}

/** The oldest public local fund for the place, or null. */
export async function findLocalFund(
  supabase: AnySupabaseClient,
  place: PlaceRef
): Promise<LocalFund | null> {
  const { data } = await supabase
    .from(ENTITY_REGISTRY.group.tableName)
    .select('id, slug, name, description, lightning_address, bitcoin_address')
    .eq('label', LOCAL_FUND_KIND)
    .eq('is_public', true)
    .eq('country_code', place.country_code.trim().toUpperCase())
    .eq('region_key', placeKey(place.region))
    .eq('locality_key', placeKey(place.locality))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? toLocalFund(data as FundRow) : null;
}

/**
 * Where "start one" goes: the group create form with a sentence the AI
 * prefill turns into a local-fund draft for this place. The words name the
 * kind and the place, which is all the form needs to pick the template.
 */
export function localFundStartHref(place: PlaceRef): string {
  const sentence = `A local fund for ${place.locality.trim()}, ${place.region.trim()}, ${place.country_code.trim().toUpperCase()}: money residents direct to their own place, governed by them, on top of what the law takes.`;
  return `${ENTITY_REGISTRY.group.createPath}?description=${encodeURIComponent(sentence)}&autofill=1`;
}
