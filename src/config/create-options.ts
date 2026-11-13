import { FileText, MessageSquare, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import {
  getEntitiesForCreateMenu,
  type EntityCategory,
  type EntityMetadata,
} from '@/config/entity-registry';

export type CreateOptionCategory = EntityCategory | 'content';

export interface CreateOption {
  /** What the row says: a plain verb ("Sell something"), from the registry's plain copy. */
  name: string;
  /** The noun for this kind ("Product", "Article"): what the Cat and its links call it. */
  kind: string;
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

// One vocabulary with the command palette: the plain verb and its one line
// (entity.plain). The header menu and the phone sheet used to list seventeen
// nouns here while the palette said the same things in words.
function optionFromEntity(entity: EntityMetadata): CreateOption {
  return {
    name: entity.plain.verb,
    kind: entity.name,
    description: entity.plain.what,
    href: entity.createPath,
    icon: entity.icon,
    ...CREATE_OPTION_ICON_STYLE,
    category: entity.category,
  };
}

export function buildCreateOptions(): CreateOption[] {
  const post: CreateOption = {
    name: 'Share an update',
    kind: 'Post',
    description: 'A short post on your timeline.',
    href: `${ROUTES.TIMELINE}?compose=true`,
    icon: MessageSquare,
    ...CREATE_OPTION_ICON_STYLE,
    category: 'content',
  };
  const article: CreateOption = {
    name: 'Write an article',
    kind: 'Article',
    description: 'Long-form, with drafts and a preview.',
    href: ROUTES.ARTICLES_NEW,
    icon: FileText,
    ...CREATE_OPTION_ICON_STYLE,
    category: 'content',
  };
  return [article, post, ...getEntitiesForCreateMenu().map(optionFromEntity)];
}

export const CREATE_OPTIONS = buildCreateOptions();

/** Consecutive options of one category, in order, for a grouped list. */
export function groupCreateOptions(
  options: readonly CreateOption[]
): { category: CreateOptionCategory; items: CreateOption[] }[] {
  const groups: { category: CreateOptionCategory; items: CreateOption[] }[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.category === option.category) {
      last.items.push(option);
    } else {
      groups.push({ category: option.category, items: [option] });
    }
  }
  return groups;
}
