import { CreateChooser } from '@/components/create/CreateChooser';

/**
 * /create is the listing chooser. Discover "List yours" and the nav Create
 * action land here. /create/[entityType] still bounces guessed slugs to the
 * canonical dashboard create path.
 */
export default function CreatePage() {
  return <CreateChooser />;
}
