import { ArrowLeft, FileQuestion } from 'lucide-react';
import { NotFoundView } from '@/components/ui/NotFoundView';
import { ROUTES } from '@/config/routes';

export default function CauseNotFound() {
  return (
    <NotFoundView
      icon={FileQuestion}
      title="Cause Not Found"
      message="The cause you are looking for does not exist or may have been removed."
      actions={[
        { href: ROUTES.DISCOVER, label: 'Discover Causes', primary: true },
        { href: ROUTES.HOME, label: 'Go Home', icon: ArrowLeft },
      ]}
    />
  );
}
