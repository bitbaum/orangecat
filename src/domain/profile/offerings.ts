import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import type {
  EconomicSkill,
  EconomicAsset,
  PublicEconomicProfile,
} from '@/services/cat/economic-profile';

export interface OwnOfferings {
  enabled: boolean;
  offerings: PublicEconomicProfile;
}

const FIELDS = 'skills, assets, asked_for, not_available_for, public_offerings_enabled';

/** The only fields that a sharing decision can expose. */
export function offeringFields(row: Record<string, unknown>): PublicEconomicProfile {
  const array = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    skills: array<EconomicSkill>(row.skills),
    assets: array<EconomicAsset>(row.assets),
    askedFor: array<string>(row.asked_for),
    notAvailableFor: array<string>(row.not_available_for),
  };
}

function snapshot(row: Record<string, unknown> | null): OwnOfferings {
  return { enabled: row?.public_offerings_enabled === true, offerings: offeringFields(row ?? {}) };
}

export async function getOwnOfferings(
  client: AnySupabaseClient,
  ownerId: string
): Promise<OwnOfferings> {
  const { data, error } = await client
    .from(DATABASE_TABLES.USER_ECONOMIC_PROFILE)
    .select(FIELDS)
    .eq('user_id', ownerId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return snapshot(data as Record<string, unknown> | null);
}

/** Change only the owner's sharing flag, preserving every learned/private field. */
export async function setOwnOfferingsSharing(
  client: AnySupabaseClient,
  ownerId: string,
  enabled: boolean
): Promise<OwnOfferings> {
  const { data, error } = await client
    .from(DATABASE_TABLES.USER_ECONOMIC_PROFILE)
    .upsert({ user_id: ownerId, public_offerings_enabled: enabled }, { onConflict: 'user_id' })
    .select(FIELDS)
    .single();
  if (error) {
    throw error;
  }
  return snapshot(data as Record<string, unknown>);
}
