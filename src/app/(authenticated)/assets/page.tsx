/**
 * Assets Page - Redirect to public discovery
 *
 * Public base paths browse listings; owner management lives under /dashboard.
 *
 * Created: 2025-01-27
 * Last Modified: 2025-01-30
 * Last Modified Summary: Redirect to /dashboard/assets for path consistency
 */

import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

export default function AssetsPage() {
  redirect(ROUTES.DISCOVER_TYPE('assets'));
}
