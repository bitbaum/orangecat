import { ImageIcon } from 'lucide-react';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { cn } from '@/lib/utils';

/**
 * What stands where a picture would be: the kind's own icon on a quiet
 * surface. One shape for every kind and every list (Discover, search, the
 * dashboard, a profile's shelves), so a listing without a photo reads as a
 * service or a loan at a glance instead of as a letter on a grey plate.
 *
 * It fills its parent, which sets the size and the aspect ratio.
 */
export function EntityCoverPlaceholder({
  type,
  className,
}: {
  /** The kind; without one (a list that mixes kinds) the plain picture mark. */
  type?: EntityType | null;
  className?: string;
}) {
  const Icon = type ? ENTITY_REGISTRY[type].icon : ImageIcon;
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-full w-full items-center justify-center bg-surface-raised text-fg-tertiary',
        className
      )}
    >
      <Icon className="h-8 w-8" strokeWidth={1.5} />
    </span>
  );
}
