import { Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROOM_COPY } from '@/config/project-room';
import { ROUTES } from '@/config/routes';

/**
 * The owner's way into a project's investor room (ADR-0012), in the owner bar
 * beside Edit. Owner-only: a visitor never learns from the public page that a
 * room exists.
 */
export function RoomOwnerAction({ projectId }: { projectId: string }) {
  return (
    <Button href={ROUTES.PROJECTS.ROOM(projectId)} variant="outline" size="sm" className="gap-1.5">
      <Lock className="h-3.5 w-3.5" aria-hidden />
      {ROOM_COPY.ownerCardTitle}
    </Button>
  );
}
