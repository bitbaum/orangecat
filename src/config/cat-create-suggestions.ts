import { CREATE_OPTIONS } from '@/config/create-options';

/** Route-bearing quick replies may open only an actual create destination. */
export function getCreateSuggestionHref(suggestion: string): string | null {
  const text = suggestion.trim();
  const editor =
    text.match(/^(?:open|show me)(?: the)? (.+?) editor[.!]?$/i) ??
    text.match(/^start(?: a| an| the)? new (.+?)[.!]?$/i);
  if (editor) {
    return (
      CREATE_OPTIONS.find(
        option =>
          option.category === 'content' && option.name.toLowerCase() === editor[1].toLowerCase()
      )?.href ?? null
    );
  }
  const match = text.match(/^open\s+([^\s]+)$/i);
  if (!match) {
    return null;
  }
  return CREATE_OPTIONS.find(option => option.href === match[1])?.href ?? null;
}

/** App-owned destinations mentioned in prose or offered as navigation replies. */
export function getCreateNavigationOptions(content: string, replies: readonly string[] = []) {
  const tokens = new Set(
    content.split(/[\s<>()\[\]`*"'\\]+/).map(token => token.replace(/[.,!;:]+$/, ''))
  );
  const destinations = new Set(replies.map(getCreateSuggestionHref).filter(Boolean));
  return CREATE_OPTIONS.filter(option => tokens.has(option.href) || destinations.has(option.href));
}
