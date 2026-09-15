export function capitalize(str: string): string {
  if (!str) {
    return str;
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function capitalizeWords(str: string): string {
  if (!str) {
    return str;
  }
  return str
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}

export function getInitial(str: string | null | undefined, fallback = 'U'): string {
  return str?.charAt(0)?.toUpperCase() || fallback;
}

export function truncateAddress(
  address: string | null | undefined,
  startChars = 8,
  endChars = startChars
): string {
  // Null-safe: Lightning-only / NWC-only wallets have no on-chain address, and
  // a null here used to crash the whole wallets page.
  if (!address) {
    return '';
  }
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// SSOT slug generator. `maxLength` truncates before random suffix is appended.
// Set `randomSuffix: true` to append a 5-char base36 suffix for ad-hoc uniqueness.
//
// NFKD first, then drop the combining marks: an accented letter becomes its
// base letter instead of vanishing. Without it `[^a-z0-9…]` deleted the letter
// outright and Zürich slugged as "zrich", Café Genève as "caf-genve" — on a
// platform whose users are mostly in Switzerland. It also cost a real person a
// handle: a Cyrillic name emptied the slug entirely and the page shipped as
// /profiles/someone (see domain/profileClaims/slug.ts, which transliterates
// before calling this because of it).
//
// NFKD does not help scripts with no Latin decomposition — Cyrillic, Greek,
// Han — so a caller that must handle those still transliterates first.
export function slugify(
  input: string,
  options: { maxLength?: number; randomSuffix?: boolean } = {}
): string {
  const base = input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const truncated = options.maxLength ? base.slice(0, options.maxLength) : base;
  if (!options.randomSuffix) {
    return truncated;
  }
  return `${truncated}-${Math.random().toString(36).slice(2, 7)}`;
}
