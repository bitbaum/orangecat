import { CREATE_OPTIONS } from '@/config/create-options';

/** Route-bearing quick replies may open only an actual create destination. */
export function getCreateSuggestionHref(suggestion: string): string | null {
  const match = suggestion.trim().match(/^open\s+([^\s]+)$/i);
  if (!match) {
    return null;
  }
  return CREATE_OPTIONS.find(option => option.href === match[1])?.href ?? null;
}
