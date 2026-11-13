/**
 * "Made with <bot>": the byline on a listing the Cat or a bot made.
 *
 * A server component that reads its own provenance (services/provenance), so
 * an entity page places it with one line. A public bot is named, wears its
 * face and links to its page; the Cat links to a chat with your own Cat; a
 * private or deleted bot is "a bot", unnamed. A listing a person made by hand
 * shows nothing.
 */
import Link from 'next/link';
import { Face } from '@/components/companions/talk/CompanionFace';
import { ROUTES } from '@/config/routes';
import type { EntityType } from '@/config/entity-registry';
import { getProvenance, type Provenance } from '@/services/provenance';

const LINK_CLASS =
  'inline-flex min-h-11 items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary hover:underline';

/** The byline itself, separate from the read so it can be shown without a database. */
export function MadeWithByline({ provenance }: { provenance: Provenance | null }) {
  if (!provenance) {
    return null;
  }
  if (provenance.bot) {
    const { id, name, avatarUrl } = provenance.bot;
    return (
      <Link href={ROUTES.AI_ASSISTANTS.VIEW(id)} className={LINK_CLASS}>
        <Face name={name} avatarUrl={avatarUrl} size={20} />
        <span>Made with {name}</span>
      </Link>
    );
  }
  if (provenance.madeBy === 'cat') {
    return (
      <Link href={ROUTES.AI_ASSISTANTS.TALK_CAT} className={LINK_CLASS}>
        Made with Cat
      </Link>
    );
  }
  return <span className="text-sm text-fg-secondary">Made with a bot</span>;
}

export default async function MadeWithChip({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const provenance = await getProvenance(entityType, entityId);
  return <MadeWithByline provenance={provenance} />;
}
