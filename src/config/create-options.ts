import { Clapperboard, MessageSquare, type LucideIcon } from 'lucide-react';
import {
  COLOR_CLASSES,
  getEntitiesForCreateMenu,
  type EntityCategory,
  type EntityMetadata,
} from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';

/**
 * 'studio' is not an entity category: nothing is created in the database when
 * you open the Studio. It leads the list anyway because making the thing comes
 * before listing it, and a chooser that only offers listings quietly tells
 * people the platform is not for makers.
 */
export type CreateOptionCategory = EntityCategory | 'content' | 'studio';

export interface CreateOption {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  category: CreateOptionCategory;
}

export const CREATE_PAGE = {
  title: 'Create',
  lede: 'Say it, or pick a type.',
} as const;

export const CREATE_CATEGORY_LABELS: Record<CreateOptionCategory, string> = {
  studio: 'Make it',
  content: 'Share',
  gateway: 'Get paid',
  business: 'Sell or fund',
  community: 'People',
  finance: 'Money',
  personal: 'For you',
};

function optionFromEntity(entity: EntityMetadata): CreateOption {
  const colors = COLOR_CLASSES[entity.colorTheme];
  return {
    name: entity.name,
    description: entity.createActionLabel,
    href: entity.createPath,
    icon: entity.icon,
    color: colors.text,
    bgColor: colors.bg,
    category: entity.category,
  };
}

export function buildCreateOptions(): CreateOption[] {
  const studio: CreateOption = {
    name: 'Studio',
    description: 'Video, music, writing, artwork',
    href: ROUTES.DASHBOARD.STUDIO,
    icon: Clapperboard,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised',
    category: 'studio',
  };
  const post: CreateOption = {
    name: 'Post',
    description: 'Share an update on your timeline',
    href: '/timeline?compose=true',
    icon: MessageSquare,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised',
    category: 'content',
  };
  return [studio, post, ...getEntitiesForCreateMenu().map(optionFromEntity)];
}

export const CREATE_OPTIONS = buildCreateOptions();

export function shouldShowDivider(current: CreateOption, next: CreateOption | undefined): boolean {
  if (!next) {
    return false;
  }
  return current.category !== next.category;
}
