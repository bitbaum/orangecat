import { ArrowLeft, UserX } from 'lucide-react';
import { NotFoundView } from '@/components/ui/NotFoundView';
import { ROUTES } from '@/config/routes';

export default function ProfileNotFound() {
  return (
    <NotFoundView
      icon={UserX}
      title="Profile Not Found"
      message="The profile you are looking for does not exist or may have been removed."
      actions={[
        { href: ROUTES.DISCOVER, label: 'Discover Projects', primary: true },
        { href: ROUTES.HOME, label: 'Go Home', icon: ArrowLeft },
      ]}
    />
  );
}
