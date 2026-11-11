/**
 * /companions/talk — the talk home.
 *
 * Every companion the person made or talks to, every group chat and the
 * fleet's own bots in one list, newest first, and the open conversation
 * beside it (a wide screen) or in its place (a phone). `?with=<id>` opens a
 * companion, `?with=fleet:<slug>` a fleet bot, `?room=<id>` a group chat.
 *
 * Sign-in is required with a return path, as the old room did.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import { TalkHome } from '@/components/companions/talk/TalkHome';

export const metadata: Metadata = { title: COMPANION_COPY.talk.title };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CompanionsTalkPage({ searchParams }: PageProps) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const params = new URLSearchParams();
    const sp = await searchParams;
    for (const key of ['with', 'room']) {
      const v = sp[key];
      if (typeof v === 'string') {
        params.set(key, v);
      }
    }
    const back = params.size ? `${ROUTES.AI_ASSISTANTS.TALK}?${params}` : ROUTES.AI_ASSISTANTS.TALK;
    redirect(`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(back)}`);
  }
  return <TalkHome />;
}
