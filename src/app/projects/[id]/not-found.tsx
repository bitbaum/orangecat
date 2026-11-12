import { ArrowLeft, FileQuestion } from 'lucide-react';
import { NotFoundView } from '@/components/ui/NotFoundView';
import { ROUTES } from '@/config/routes';

export default function ProjectNotFound() {
  return (
    <NotFoundView
      icon={FileQuestion}
      title="Project Not Found"
      message="The project you are looking for does not exist or may have been removed."
      actions={[
        { href: ROUTES.PROJECTS.LIST, label: 'Browse Projects', primary: true },
        { href: ROUTES.HOME, label: 'Go Home', icon: ArrowLeft },
      ]}
    />
  );
}
