import Button from '@/components/ui/Button';
import type { EntityConfig, BaseEntity } from '@/types/entity';

type EmptyStateConfig = NonNullable<EntityConfig<BaseEntity>['emptyState']>;

/**
 * An entity list's empty state always ends in the way to make the first one.
 *
 * Each entity config used to bring its own button (each with its own colour
 * class), and the ones that forgot — wishlists, circles, documents — told a
 * person to "create your first wishlist" with no way to do it. The shell now
 * adds the create button wherever the config gives no action of its own.
 */
export function emptyStateWithCreate(
  emptyState: EmptyStateConfig | undefined,
  config: Pick<EntityConfig<BaseEntity>, 'createPath' | 'name'>,
  createButtonLabel?: string
): EmptyStateConfig | undefined {
  if (!emptyState || emptyState.action) {
    return emptyState;
  }
  return {
    ...emptyState,
    action: (
      <Button href={config.createPath} className="min-h-11">
        {createButtonLabel || `Create ${config.name}`}
      </Button>
    ),
  };
}
