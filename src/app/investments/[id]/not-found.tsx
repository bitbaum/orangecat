import { ArrowLeft, FileQuestion } from 'lucide-react';
import { NotFoundView } from '@/components/ui/NotFoundView';
import { ROUTES } from '@/config/routes';

export default function InvestmentNotFound() {
  return (
    <NotFoundView
      icon={FileQuestion}
      title="Investment Not Found"
      message="The investment you are looking for does not exist or may have been removed."
      actions={[
        { href: ROUTES.DISCOVER, label: 'Discover', primary: true },
        { href: ROUTES.HOME, label: 'Go Home', icon: ArrowLeft },
      ]}
    />
  );
}
