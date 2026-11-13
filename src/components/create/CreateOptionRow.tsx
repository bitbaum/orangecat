import { cn } from '@/lib/utils';
import type { CreateOption } from '@/config/create-options';

/**
 * One create choice, as every create surface draws it: an icon tile, the plain
 * verb, and one line saying what it is. The header's menu and the phone's
 * sheet both render this, so the two lists are one shape (the sheet used to be
 * a grid of bare nouns).
 */
export function CreateOptionRowContent({ option }: { option: CreateOption }) {
  return (
    <>
      <span className="oc-icon-tile h-9 w-9 shrink-0" aria-hidden="true">
        <option.icon className={cn('h-4 w-4', option.color)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-fg-primary">{option.name}</span>
        <span className="block text-xs text-fg-secondary line-clamp-1">{option.description}</span>
      </span>
    </>
  );
}
