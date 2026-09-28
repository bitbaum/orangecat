import Link from 'next/link';
import { VoiceCreate } from '@/components/create/VoiceCreate';
import {
  CREATE_CATEGORY_LABELS,
  CREATE_OPTIONS,
  CREATE_PAGE,
  type CreateOption,
} from '@/config/create-options';
import { ROUTES } from '@/config/routes';

function groupOptions(
  options: CreateOption[]
): { category: CreateOption['category']; items: CreateOption[] }[] {
  const groups: { category: CreateOption['category']; items: CreateOption[] }[] = [];
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

export function CreateChooser() {
  const groups = groupOptions(CREATE_OPTIONS);

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-10">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-fg-primary">
        {CREATE_PAGE.title}
      </h1>
      <p className="mt-1 text-base text-fg-secondary">{CREATE_PAGE.lede}</p>

      <VoiceCreate className="mt-5" />

      <div className="mt-6 space-y-6">
        {groups.map(group => (
          <section key={group.category} aria-labelledby={`create-${group.category}`}>
            <h2
              id={`create-${group.category}`}
              className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary"
            >
              {CREATE_CATEGORY_LABELS[group.category]}
            </h2>
            <ul className="divide-y divide-subtle rounded-lg border border-default bg-surface-base">
              {group.items.map(option => {
                const Icon = option.icon;
                return (
                  <li key={option.href}>
                    <Link
                      href={option.href}
                      className="flex min-h-14 items-center gap-3 px-3 py-3 hover:bg-surface-raised"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${option.bgColor}`}
                      >
                        <Icon className={`h-5 w-5 ${option.color}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-fg-primary">{option.name}</span>
                        <span className="block truncate text-sm text-fg-secondary">
                          {option.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-fg-secondary">
        <Link
          href={ROUTES.WHAT_YOU_CAN_DO}
          className="underline underline-offset-2 hover:text-fg-primary"
        >
          {CREATE_PAGE.browseAll}
        </Link>
      </p>
    </div>
  );
}
