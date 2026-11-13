import { permanentRedirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/**
 * /technology was a second, unlinked copy of the Technology Stack section on
 * /docs, ending in two buttons that led away from it. One page says it now.
 */
export default function TechnologyPage(): never {
  permanentRedirect(ROUTES.DOCS);
}
