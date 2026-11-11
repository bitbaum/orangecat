/**
 * Who the New message picker lists. Unnamed placeholder accounts ("user_4a12…",
 * no display name, no picture) mean nothing to a new member, so with no search
 * typed they are dropped; people with a name and a photo come first. A typed
 * search still finds everyone, placeholders last.
 */
export interface PickerPerson {
  id: string;
  username?: string | null;
  name?: string | null;
  avatar_url?: string | null;
}

const PLACEHOLDER_HANDLE = /^user_[0-9a-f]{6,}$/i;

export function isPlaceholderPerson(p: PickerPerson): boolean {
  const name = (p.name ?? '').trim();
  const unnamed = !name || name === p.username || PLACEHOLDER_HANDLE.test(name);
  return unnamed && PLACEHOLDER_HANDLE.test(p.username ?? '');
}

function score(p: PickerPerson): number {
  return (isPlaceholderPerson(p) ? 0 : 2) + (p.avatar_url ? 1 : 0);
}

export function rankPeopleForPicker<T extends PickerPerson>(
  people: T[],
  { searching, selfId }: { searching: boolean; selfId?: string }
): T[] {
  const list = people.filter(p => p.id !== selfId && (searching || !isPlaceholderPerson(p)));
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => score(b.p) - score(a.p) || a.i - b.i)
    .map(x => x.p);
}
