import { logger } from '@/utils/logger';
import supabase from '@/lib/supabase/browser';
import type { FilterChain } from '@/lib/supabase/untyped';
import { getTableName } from '@/config/entity-registry';
import { STATUS, ENTITY_STATUS } from '@/config/database-constants';
import { sortGenericResults } from '@/services/search/processors';
import type { SortOption } from '@/services/search/types';
import type { DiscoverTabType } from '@/components/discover/DiscoverTabs';
import type { GenericPublicEntity } from '@/components/entity/variants/GenericPublicCard';
import { ilikeAny } from '@/lib/db/likePattern';

type Setter<T> = (v: T) => void;

interface GenericSetters {
  setGenericLoading: Setter<boolean>;
  setCauses: Setter<GenericPublicEntity[]>;
  setEvents: Setter<GenericPublicEntity[]>;
  setProducts: Setter<GenericPublicEntity[]>;
  setServices: Setter<GenericPublicEntity[]>;
  setGroups: Setter<GenericPublicEntity[]>;
  setCircles: Setter<GenericPublicEntity[]>;
  setWishlists: Setter<GenericPublicEntity[]>;
  setResearch: Setter<GenericPublicEntity[]>;
  setAiAssistants: Setter<GenericPublicEntity[]>;
}

type GroupRow = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  slug?: string | null;
};

type ResearchRow = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  field?: string | null;
  created_at: string;
};

export async function fetchDiscoverGenericData(
  activeTab: DiscoverTabType,
  searchTerm: string,
  sortBy: SortOption,
  setters: GenericSetters
) {
  const {
    setGenericLoading,
    setCauses,
    setEvents,
    setProducts,
    setServices,
    setGroups,
    setCircles,
    setWishlists,
    setResearch,
    setAiAssistants,
  } = setters;

  const limit = 50;
  const should = (tab: DiscoverTabType) => activeTab === 'all' || activeTab === tab;

  // `base` is a builder over a different table on every call, so it is accepted
  // structurally — the column names in each `.select()` are still checked
  // against the real schema at the call sites below.
  const buildQuery = <T, B extends FilterChain<B>>(
    base: B,
    tab: DiscoverTabType,
    tabLimit: number,
    searchFields = 'title,description'
  ) => {
    let q = base
      .order('created_at', { ascending: false })
      .limit(activeTab === tab ? limit : tabLimit);
    if (searchTerm) {
      q = q.or(ilikeAny(searchFields.split(','), searchTerm));
    }
    return q as unknown as Promise<{ data: T[] | null; error: unknown }>;
  };

  setGenericLoading(true);
  try {
    const [
      causesRes,
      eventsRes,
      productsRes,
      servicesRes,
      groupsRes,
      circlesRes,
      wishlistsRes,
      researchRes,
      aiRes,
    ] = await Promise.all([
      should('causes')
        ? buildQuery(
            supabase
              .from(getTableName('cause'))
              .select('id, title, description, status, cause_category, created_at')
              .eq('status', STATUS.CAUSES.ACTIVE),
            'causes',
            8
          )
        : Promise.resolve({ data: null, error: null }),

      should('events')
        ? buildQuery(
            supabase
              .from(getTableName('event'))
              .select('id, title, description, status, category, created_at')
              .in('status', [STATUS.EVENTS.PUBLISHED, STATUS.EVENTS.OPEN, STATUS.EVENTS.ONGOING]),
            'events',
            8
          )
        : Promise.resolve({ data: null, error: null }),

      should('products')
        ? buildQuery(
            supabase
              .from(getTableName('product'))
              .select('id, title, description, status, category, created_at')
              .eq('status', STATUS.PRODUCTS.ACTIVE),
            'products',
            8
          )
        : Promise.resolve({ data: null, error: null }),

      should('services')
        ? buildQuery(
            supabase
              .from(getTableName('service'))
              .select('id, title, description, status, category, created_at')
              .eq('status', STATUS.SERVICES.ACTIVE),
            'services',
            8
          )
        : Promise.resolve({ data: null, error: null }),

      should('groups')
        ? buildQuery(
            supabase
              .from(getTableName('group'))
              .select('id, name, description, is_public, created_at, slug')
              .eq('is_public', true),
            'groups',
            8,
            'name,description'
          )
        : Promise.resolve({ data: null, error: null }),

      should('circles')
        ? buildQuery(
            supabase
              .from(getTableName('circle'))
              .select('id, title, description, visibility, status, category, created_at')
              .eq('visibility', 'public')
              .eq('status', ENTITY_STATUS.ACTIVE),
            'circles',
            8
          )
        : Promise.resolve({ data: null, error: null }),

      should('wishlists')
        ? buildQuery(
            supabase
              .from(getTableName('wishlist'))
              .select('id, title, description, type, created_at')
              .eq('visibility', 'public')
              .eq('is_active', true),
            'wishlists',
            8
          )
        : Promise.resolve({ data: null, error: null }),

      should('research')
        ? buildQuery(
            supabase
              .from(getTableName('research'))
              .select('id, title, description, status, field, created_at')
              .eq('is_public', true)
              .eq('status', ENTITY_STATUS.ACTIVE),
            'research',
            8
          )
        : Promise.resolve({ data: null, error: null }),

      should('ai_assistants')
        ? buildQuery(
            supabase
              .from(getTableName('ai_assistant'))
              .select('id, title, description, status, category, created_at')
              .eq('is_public', true)
              .eq('status', STATUS.AI_ASSISTANTS.ACTIVE),
            'ai_assistants',
            8
          )
        : Promise.resolve({ data: null, error: null }),
    ]);

    const sorted = (items: GenericPublicEntity[]) => sortGenericResults(items, sortBy, searchTerm);

    if (should('causes')) {
      setCauses(sorted((causesRes.data ?? []) as unknown as GenericPublicEntity[]));
    }
    if (should('events')) {
      setEvents(sorted((eventsRes.data ?? []) as unknown as GenericPublicEntity[]));
    }
    if (should('products')) {
      setProducts(sorted((productsRes.data ?? []) as unknown as GenericPublicEntity[]));
    }
    if (should('services')) {
      setServices(sorted((servicesRes.data ?? []) as unknown as GenericPublicEntity[]));
    }
    if (should('groups')) {
      const { isFixtureGroupTitle } = await import('@/config/public-directory');
      setGroups(
        sorted(
          ((groupsRes.data ?? []) as unknown as GroupRow[])
            .filter(r => !isFixtureGroupTitle(r.name))
            .map(
              r =>
                ({
                  id: r.id,
                  title: r.name,
                  description: r.description ?? null,
                  created_at: r.created_at,
                  slug: r.slug ?? null,
                }) satisfies GenericPublicEntity
            )
        )
      );
    }
    if (should('circles')) {
      setCircles(sorted((circlesRes.data ?? []) as unknown as GenericPublicEntity[]));
    }
    if (should('wishlists')) {
      setWishlists(sorted((wishlistsRes.data ?? []) as unknown as GenericPublicEntity[]));
    }
    if (should('research')) {
      setResearch(
        sorted(
          ((researchRes.data ?? []) as unknown as ResearchRow[]).map(
            r =>
              ({
                id: r.id,
                title: r.title,
                description: r.description ?? null,
                status: r.status ?? null,
                category: r.field ?? null,
                created_at: r.created_at,
              }) satisfies GenericPublicEntity
          )
        )
      );
    }
    if (should('ai_assistants')) {
      setAiAssistants(sorted((aiRes.data ?? []) as unknown as GenericPublicEntity[]));
    }
  } catch (error) {
    logger.error('Error fetching discover entities', error, 'Discover');
  } finally {
    setGenericLoading(false);
  }
}
