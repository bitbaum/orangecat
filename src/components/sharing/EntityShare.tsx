'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import ShareContent from './ShareContent';
import { APP_NAME, SITE_URL } from '@/config/brand';

interface EntityShareProps {
  entityType: EntityType;
  entityId: string;
  title: string;
  description?: string;
  /** Override for entities whose public route is slug-based rather than ID-based. */
  publicPath?: string;
  className?: string;
}

/**
 * Generic share wrapper for any entity type.
 * Derives the share URL from ENTITY_REGISTRY (SSOT).
 */
export default function EntityShare({
  entityType,
  entityId,
  title,
  description,
  publicPath,
  className = '',
}: EntityShareProps) {
  const [isOpen, setIsOpen] = useState(false);

  const entityMeta = ENTITY_REGISTRY[entityType];
  const origin = typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  const shareUrl = `${origin}${publicPath ?? `${entityMeta.publicBasePath}/${entityId}`}`;
  const shareTitle = title;
  const shareDescription = description || `Check out ${title} on ${APP_NAME}`;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg border border-default hover:bg-surface-raised text-sm font-medium text-fg-primary transition-colors ${className}`}
        aria-label={`Share ${title}`}
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <ShareContent
        title={shareTitle}
        description={shareDescription}
        url={shareUrl}
        onClose={() => setIsOpen(false)}
        titleText={`Share ${entityMeta.name}`}
      />
    </div>
  );
}
