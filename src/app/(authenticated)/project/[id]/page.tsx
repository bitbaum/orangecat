import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/**
 * Redirect from old /project/[id] route to new /projects/[id] route
 *
 * This ensures backward compatibility for any bookmarks or external links
 * that use the old singular route pattern.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created redirect page to consolidate routes to /projects/[id]
 */
export default async function ProjectRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(ROUTES.PROJECTS.VIEW(id));
}
