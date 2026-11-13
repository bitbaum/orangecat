import { FileText, MessageSquare, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { getEntitiesForCreateMenu, type EntityMetadata } from '@/config/entity-registry';
import { INTENT_IDS, INTENTS, type IntentId } from '@/config/intents';

/** Writing ("content") first, then the registry's intents in their order. */
export type CreateOptionCategory = 'content' | IntentId;

export interface CreateOption {
  /** What the person came to do: the registry's `plain.verb` for an entity. */
  name: string;
  /** One concrete line: the registry's `plain.example` for an entity. */
  description: string;
  /** The type's name, shown small so the row still matches the page it opens. */
  typeLabel?: string;
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

/** Group headings: "Share" for writing, then the intents' own titles. */
export const CREATE_CATEGORY_LABELS: Record<CreateOptionCategory, string> = {
  content: 'Share',
  ...(Object.fromEntries(INTENT_IDS.map(id => [id, INTENTS[id].title])) as Record<
    IntentId,
    string
  >),
};

/** The row for the person who arrives with a need rather than a type. */
export const CREATE_RAISE_ROW = {
  title: 'Need money for something?',
  description: 'Say what you need — the Cat prices it and writes the page.',
  href: ROUTES.RAISE,
} as const;

const CREATE_OPTION_ICON_STYLE = {
  color: 'text-fg-primary',
  bgColor: 'bg-surface-raised',
} as const;

// Every human-facing create surface reads the registry's plain copy, never
// the type name alone (entity-registry.ts, `plain`), and groups by intent
// (intents.ts). The three choosers used to show "Product" / "Sell products"
// grouped by an internal category.
function optionFromEntity(entity: EntityMetadata): CreateOption {
  return {
    name: entity.plain.verb,
    description: entity.plain.example,
    typeLabel: entity.name,
    href: entity.createPath,
    icon: entity.icon,
    ...CREATE_OPTION_ICON_STYLE,
    category: entity.plain.intent,
  };
}

function byIntent(entities: EntityMetadata[]): EntityMetadata[] {
  return INTENT_IDS.flatMap(intent => entities.filter(entity => entity.plain.intent === intent));
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
  return [article, post, ...byIntent(getEntitiesForCreateMenu()).map(optionFromEntity)];
}

export const CREATE_OPTIONS = buildCreateOptions();

export interface CreateOptionGroup {
  category: CreateOptionCategory;
  label: string;
  items: CreateOption[];
}

/** Consecutive options of one category, with the heading each group shows. */
export function groupCreateOptions(options: CreateOption[] = CREATE_OPTIONS): CreateOptionGroup[] {
  const groups: CreateOptionGroup[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.category === option.category) {
      last.items.push(option);
    } else {
      groups.push({
        category: option.category,
        label: CREATE_CATEGORY_LABELS[option.category],
        items: [option],
      });
    }
  }
  return groups;
}
