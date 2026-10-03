import { MessageSquare, PartyPopper, type LucideIcon } from 'lucide-react';
import { PARTY, partyCatHref } from '@/config/party';
import {
  COLOR_CLASSES,
  ENTITY_REGISTRY,
  getEntitiesForCreateMenu,
  type EntityCategory,
  type EntityMetadata,
} from '@/config/entity-registry';

export type CreateOptionCategory = EntityCategory | 'content';

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
  /** The way out for the person the list does not answer: the map. */
  browseAll: 'Not sure which one? See everything you can do, explained.',
} as const;

export const CREATE_CATEGORY_LABELS: Record<CreateOptionCategory, string> = {
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
  const post: CreateOption = {
    name: 'Post',
    description: 'Share an update on your timeline',
    href: '/timeline?compose=true',
    icon: MessageSquare,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised',
    category: 'content',
  };
  // Not a type: a whole occasion the Cat sets up (src/config/party.ts). It sits
  // directly above Event, the type it is built on, so the "People" group stays
  // one run and someone scanning for "event" finds the one-click version first.
  const party: CreateOption = {
    name: PARTY.label,
    description: PARTY.description,
    href: partyCatHref(),
    icon: PartyPopper,
    color: 'text-fg-primary',
    bgColor: 'bg-surface-raised',
    category: ENTITY_REGISTRY.event.category,
  };
  const entities = getEntitiesForCreateMenu().flatMap(entity =>
    entity.type === 'event' ? [party, optionFromEntity(entity)] : [optionFromEntity(entity)]
  );
  return [post, ...entities];
}

export const CREATE_OPTIONS = buildCreateOptions();

export function shouldShowDivider(current: CreateOption, next: CreateOption | undefined): boolean {
  if (!next) {
    return false;
  }
  return current.category !== next.category;
}
