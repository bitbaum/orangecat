'use client';

import { entityCover } from '@/lib/entities/cover';
import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import type { ScalableProfile } from '@/services/profile/types';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { logger } from '@/utils/logger';
import { EntityType, ENTITY_REGISTRY } from '@/config/entity-registry';
import React from 'react';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';

export interface EntityData {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  created_at: string;
  price?: number;
  hourly_rate?: number;
  fixed_price?: number;
  ticket_price?: number;
  goal_amount?: number;
  original_amount?: number;
  estimated_value?: number;
  currency?: string;
  is_free?: boolean;
  thumbnail_url?: string;
  avatar_url?: string;
  images?: string[];
  start_date?: string;
  end_date?: string;
  venue_name?: string;
  venue_city?: string;
  is_online?: boolean;
  event_type?: string;
  pricing_type?: string;
  type?: string;
  verification_status?: string;
  pricing_model?: string;
}

export interface EntityMetadata {
  name: string;
  namePlural: string;
  icon: string;
  colorTheme: string;
}

export { formatRelativeTimeCompact as getRelativeTime } from '@/utils/dates';

export function useProfileEntityTab(profile: ScalableProfile, entityType: EntityType) {
  const [entities, setEntities] = useState<EntityData[]>([]);
  const [metadata, setMetadata] = useState<EntityMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  const entityMeta = ENTITY_REGISTRY[entityType];
  const getDashboardPath = () => entityMeta?.basePath || ROUTES.DASHBOARD.HOME;
  const getCreatePath = () => entityMeta?.createPath || `${getDashboardPath()}/create`;
  const getViewPath = (id: string) => `${entityMeta?.publicBasePath || `/${entityType}s`}/${id}`;

  const Icon = entityMeta?.icon || Package;
  const displayName = metadata?.namePlural || entityType;

  useEffect(() => {
    if (!profile.id) {
      return;
    }
    const controller = new AbortController();
    const fetchEntities = async () => {
      try {
        setLoading(true);
        const response = await fetch(API_ROUTES.PROFILES.ENTITIES(profile.id, entityType), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        const result = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        if (result.success && result.data) {
          setEntities(result.data.data || []);
          setMetadata(result.data.metadata || null);
        }
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          return;
        }
        logger.error('Failed to fetch entities:', error);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchEntities();
    return () => controller.abort();
  }, [profile.id, entityType]);

  const getTitle = (entity: EntityData) => entity.title || entity.name || 'Untitled';

  /** The kind's cover (ENTITY_COVER): the picture its page and Discover card show. */
  const getThumbnail = (entity: EntityData) =>
    entityCover(entityType, entity as unknown as Record<string, unknown>);

  const getPriceDisplay = (entity: EntityData): React.ReactNode => {
    if (entity.is_free) {
      return 'Free';
    }

    const priceValue =
      entity.price ||
      entity.hourly_rate ||
      entity.fixed_price ||
      entity.ticket_price ||
      entity.goal_amount ||
      entity.original_amount ||
      entity.estimated_value;

    if (!priceValue) {
      return null;
    }

    const label =
      entityType === 'service' && entity.pricing_type === 'hourly'
        ? '/hr'
        : entityType === 'loan'
          ? ' requested'
          : entityType === 'asset'
            ? ' value'
            : '';

    return React.createElement(
      'span',
      { className: 'flex items-center gap-1' },
      React.createElement(CurrencyDisplay, {
        amount: priceValue,
        currency: entity.currency || PLATFORM_DEFAULT_CURRENCY,
        size: 'sm',
      }),
      label && React.createElement('span', { className: 'text-fg-secondary text-xs' }, label)
    );
  };

  return {
    entities,
    metadata,
    loading,
    Icon,
    displayName,
    getDashboardPath,
    getCreatePath,
    getViewPath,
    getTitle,
    getThumbnail,
    getPriceDisplay,
  };
}
