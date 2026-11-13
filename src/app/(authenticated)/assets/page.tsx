/**
 * /assets — the public list of assets, like every other kind's list route.
 *
 * It is the breadcrumb on a public asset page. It used to redirect to
 * /dashboard/assets, the visitor's OWN assets: a sign-in wall for a stranger,
 * an empty "My Assets" for a signed-in visitor. The owner's list stays at
 * /dashboard/assets.
 */

import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { DISCOVER_TYPE_SLUGS } from '@/config/discover-tabs';

export default function AssetsPage() {
  redirect(ROUTES.DISCOVER_TYPE(DISCOVER_TYPE_SLUGS.asset));
}
