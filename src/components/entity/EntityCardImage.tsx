'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { EntityCoverPlaceholder } from '@/components/entity/EntityCoverPlaceholder';
import { cn } from '@/lib/utils';
import type { EntityType } from '@/config/entity-registry';

function ImageLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-raised/40">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-strong border-t-fg-primary" />
    </div>
  );
}

interface EntityCardImageProps {
  imageSrc: string | undefined | null;
  title: string;
  compact: boolean;
  href: string;
  /** The kind, for the stand-in shown when there is no picture. */
  entityType?: EntityType | null;
}

export function EntityCardImage({
  imageSrc,
  title,
  compact,
  href,
  entityType,
}: EntityCardImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const showImage = imageSrc && !imageError;

  return (
    <Link
      href={href}
      className={cn(
        'relative w-full overflow-hidden bg-surface-raised block',
        compact ? 'aspect-[4/3]' : 'aspect-video'
      )}
    >
      {showImage ? (
        <>
          <Image
            src={imageSrc!}
            alt={title}
            fill
            className={cn(
              'object-cover transition-all duration-300',
              imageLoaded && 'group-hover:scale-105',
              !imageLoaded && 'opacity-0'
            )}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized={imageSrc!.startsWith('data:') || imageSrc!.startsWith('blob:')}
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />
          {!imageLoaded && <ImageLoader />}
        </>
      ) : (
        <EntityCoverPlaceholder type={entityType} />
      )}
    </Link>
  );
}
