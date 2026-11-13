import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';

/** The same skeleton the page shows until the account is known: one, not three. */
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
