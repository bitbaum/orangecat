import { CREATE_OPTIONS, CREATE_PAGE } from '@/config/create-options';

/** Trusted application facts, separate from facts about the user's own records. */
export function buildPlatformNavigationContext(): string {
  const writing = CREATE_OPTIONS.filter(option => option.category === 'content')
    .map(option => `- [${option.name}](${option.href}): ${option.description}.`)
    .join('\n');
  return `## Verified application navigation\n${writing}\n${CREATE_PAGE.title} opens these writing editors; no project is required. These are application capabilities, even for an empty profile. The grounding refusal applies to unknown facts about the user's records, not these verified navigation destinations. Answer application editor-location questions with the appropriate clickable link, without inventing facts about a person.`;
}

/** Only actual catalog destinations count as supported navigation during repair. */
export function supportedCreateLinksIn(content: string): Set<string> {
  const destinations = new Set(CREATE_OPTIONS.map(option => option.href));
  return new Set(
    [...content.matchAll(/\]\(([^)\s]+)\)/g)]
      .map(match => match[1])
      .filter(href => destinations.has(href))
  );
}
