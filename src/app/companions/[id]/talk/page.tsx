/**
 * /companions/[id]/talk — the old address of a companion's room.
 *
 * The room is now one of the chats on the talk home, so this forwards there
 * with the companion open. Kept because the address is on profile buttons,
 * in notifications and in people's history.
 */

import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanionTalkPage({ params }: PageProps) {
  const { id } = await params;
  redirect(ROUTES.AI_ASSISTANTS.TALK_WITH(id));
}
