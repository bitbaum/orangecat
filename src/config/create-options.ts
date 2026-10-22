import { FileText, MessageSquare, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import {
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
  lede: 'Write an article, share an update, or start something new.',
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

const CREATE_OPTION_ICON_STYLE = {
  color: 'text-fg-primary',
  bgColor: 'bg-surface-raised',
} as const;

function optionFromEntity(entity: EntityMetadata): CreateOption {
  return {
    name: entity.name,
    description: entity.createActionLabel,
    href: entity.createPath,
    icon: entity.icon,
    ...CREATE_OPTION_ICON_STYLE,
    category: entity.category,
  };
}

export function buildCreateOptions(): CreateOption[] {
  const post: CreateOption = {
    name: 'Post',
    description: 'Share an update on your timeline',
    href: `${ROUTES.TIMELINE}?compose=true`,
    icon: MessageSquare,
    ...CREATE_OPTION_ICON_STYLE,
    category: 'content',
  };
  const article: CreateOption = {
    name: 'Article',
    description: 'Write a long-form article with drafts and preview',
    href: ROUTES.ARTICLES_NEW,
    icon: FileText,
    ...CREATE_OPTION_ICON_STYLE,
    category: 'content',
  };
  return [article, post, ...getEntitiesForCreateMenu().map(optionFromEntity)];
}

export const CREATE_OPTIONS = buildCreateOptions();

export function shouldShowDivider(current: CreateOption, next: CreateOption | undefined): boolean {
  if (!next) {
    return false;
  }
  return current.category !== next.category;
}
