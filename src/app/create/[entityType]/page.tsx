import { redirect } from 'next/navigation';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';

/**
 * /create/[entityType] — catch-all that bounces guessed URLs (e.g.
 * /create/project, /create/ai-assistant) to the canonical create path
 * from ENTITY_REGISTRY. Previously these all 404'd because the create
 * flows live under /dashboard/<entity>/create.
 *
 * Nothing internal links here — this exists purely as a graceful
 * recovery for users who type the URL or follow stale external links.
 */
export default async function CreateEntityRedirect({
  params,
}: {
  params: Promise<{ entityType: string }>;
}) {
  const { entityType } = await params;

  // URL slugs commonly use hyphens (ai-assistant, ai_assistants —
  // /dashboard/companions/create), but the registry keys are
  // snake_case singular (ai_assistant). Try the most likely
  // normalizations: the slug as-is, hyphen → underscore, and the
  // trailing-`s` plural stripped. Unknown slugs fall back to the chooser.
  const candidates = [
    entityType,
    entityType.replace(/-/g, '_'),
    entityType.replace(/-/g, '_').replace(/s$/, ''),
  ];
  const meta = candidates.map(slug => ENTITY_REGISTRY[slug as EntityType]).find(Boolean);
  redirect(meta?.createPath ?? '/create'); // chooser, not a silent project create
}
