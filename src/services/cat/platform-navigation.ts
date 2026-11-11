import { CREATE_OPTIONS, CREATE_PAGE } from '@/config/create-options';
import { ROUTES } from '@/config/routes';
import type { EntitySummary } from '@/services/ai/document-context-types';

/** Trusted application facts, separate from facts about the user's own records. */
export function buildPlatformNavigationContext(entities: EntitySummary[] = []): string {
  const writing = CREATE_OPTIONS.filter(option => option.category === 'content')
    .map(option => `- [${option.name}](${option.href}): ${option.description}.`)
    .join('\n');
  const rooms = entities
    .filter(entity => entity.type === 'project')
    .map(entity => `- ${JSON.stringify(entity.title)}: ${ROUTES.PROJECTS.ROOM(entity.id)}`)
    .join('\n');
  return `## Verified application navigation\n${writing}\n${CREATE_PAGE.title} opens these writing editors; no project is required. These are application capabilities, even for an empty profile. The grounding refusal applies to unknown facts about the user's records, not these verified navigation destinations. Answer application editor-location questions with the appropriate clickable link, without inventing facts about a person.

Investor rooms belong to projects. The project's owner can edit its room, add documents and a deck, issue recipient links, and see opens. For a request to see or use an investor room, offer the relevant project's room link below. If several projects could fit, ask which one and offer their links. If no project is present in the fetched context, do not claim none exists: link to [Your projects](${ROUTES.DASHBOARD.PROJECTS}) to choose one, or [Create a project](${ROUTES.PROJECTS.CREATE}). Do not invent a project ID, a recipient token, room contents, or claim the room has been created or shared.
${rooms || 'No project-specific room links were fetched this turn.'}
Cat can also set up and manage a room in chat: get_investor_room reads its content, deck, recipient links, opens and connected product record; save_investor_room changes only supplied fields; generate_investor_deck makes a sourced first deck; save_investor_deck saves edited slides; create_investor_room_link creates a recipient-specific link; revoke_investor_room_link switches it off. Read before editing, show the proposed changes, use the normal confirmation flow for writes, and do not claim an invitation was sent merely because a link was created.`;
}

/** Only actual catalog destinations count as supported navigation during repair. */
export function supportedCreateLinksIn(content: string, evidence: string[] = []): Set<string> {
  const destinations = new Set(CREATE_OPTIONS.map(option => option.href));
  destinations.add(ROUTES.DASHBOARD.PROJECTS);
  destinations.add(ROUTES.PROJECTS.CREATE);
  // A room URL is trusted only when this turn's fetched evidence names it.
  for (const source of evidence) {
    for (const match of source.matchAll(/\/projects\/([a-zA-Z0-9-]+)\/room(?=[\s)\n]|$)/g)) {
      destinations.add(ROUTES.PROJECTS.ROOM(match[1]));
    }
  }
  return new Set(
    [...content.matchAll(/\]\(([^)\s]+)\)/g)]
      .map(match => match[1])
      .filter(href => destinations.has(href))
  );
}
