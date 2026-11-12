import { ArrowLeft, FileQuestion } from 'lucide-react';
import { NotFoundView } from '@/components/ui/NotFoundView';
import { ROUTES } from '@/config/routes';

export default function LoanNotFound() {
  return (
    <NotFoundView
      icon={FileQuestion}
      title="Loan Not Found"
      message="The loan you are looking for does not exist or may have been removed."
      actions={[
        { href: ROUTES.DISCOVER, label: 'Discover', primary: true },
        { href: ROUTES.HOME, label: 'Go Home', icon: ArrowLeft },
      ]}
    />
  );
}
