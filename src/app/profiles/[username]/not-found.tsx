import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ArrowLeft, UserX } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { GRADIENTS } from '@/config/gradients';

export default function ProfileNotFound() {
  return (
    <div className={`min-h-screen ${GRADIENTS.grayLight} flex items-center justify-center p-4`}>
      <Card className="max-w-lg mx-auto shadow-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <UserX className="w-16 h-16 text-fg-tertiary" />
          </div>
          <CardTitle>Profile Not Found</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-fg-secondary mb-6">
            The profile you are looking for does not exist or may have been removed.
          </p>
          <div className="flex gap-2 justify-center">
            <Button href={ROUTES.HOME} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Home
            </Button>
            <Link href={ROUTES.DISCOVER}>
              <Button>Discover Projects</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
