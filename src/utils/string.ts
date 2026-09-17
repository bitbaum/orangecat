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

/**
 * Cyrillic → Latin, one letter at a time. A list of accents is never finished,
 * so everything with a decomposable base (é, ü, å, ñ) is handled by NFKD
 * below and only the scripts that do NOT decompose need a table.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ґ: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'yi',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/**
 * Latin letters keep their base (é → e, ü → u, ß → ss); Cyrillic is mapped.
 *
 * German digraphs FIRST, then NFKD + combining-mark strip for everything else.
 * Neither ß nor its capital ẞ has a decomposition, so NFKD alone deletes them:
 * `Straße` slugged as `strae`.
 */
export function transliterate(input: string): string {
  return input
    .replace(/[ßẞ]/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0400-\u04ff]/g, ch => {
      const out = CYRILLIC[ch.toLowerCase()];
      return out === undefined ? '' : out;
    });
}

/**
 * SSOT slug generator. `maxLength` truncates before the random suffix is
 * appended; `randomSuffix: true` appends a 5-char base36 suffix for ad-hoc
 * uniqueness.
 *
 * Names are TRANSLITERATED before the ASCII filter, not filtered through it.
 * Without that step every non-ASCII letter was simply deleted: `Café Genève`
 * became `caf-genve`, and a Cyrillic or Japanese name produced the EMPTY
 * STRING — which, under a unique constraint, means the second such record
 * cannot be saved at all. It also means a slug that identifies nobody: walked
 * live on 2026-09-11, `Марина` became `/profiles/someone`. That was patched in
 * domain/profileClaims for profile claims alone; groups, organizations and the
 * entity create form still went through the broken path, which is why the fix
 * belongs here instead.
 *
 * A name that transliterates to nothing still yields '' — callers that need a
 * guaranteed-unique value append their own suffix (see `claimSlugFor`).
 */
export function slugify(
  input: string,
  options: { maxLength?: number; randomSuffix?: boolean } = {}
): string {
  // transliterate() has already done NFKD and dropped the combining marks, so
  // by here every letter that CAN be ASCII is ASCII.
  const base = transliterate(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const truncated = options.maxLength ? base.slice(0, options.maxLength) : base;
  if (!options.randomSuffix) {
    return truncated;
  }
  const suffix = Math.random().toString(36).slice(2, 7);
  // A name that transliterates to nothing (Japanese, Chinese, emoji) leaves an
  // empty base. Joining it would produce a slug starting with a dash.
  return truncated ? `${truncated}-${suffix}` : suffix;
}
