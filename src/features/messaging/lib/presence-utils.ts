import { formatDate } from '@/utils/dates';
export function formatLastSeen(lastSeenAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - lastSeenAt.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'Active now';
  }
  if (minutes < 60) {
    return `Active ${minutes}m ago`;
  }
  if (hours < 24) {
    return `Active ${hours}h ago`;
  }
  if (days === 1) {
    return 'Active yesterday';
  }
  if (days < 7) {
    return `Active ${days}d ago`;
  }
  return formatDate(lastSeenAt);
}
