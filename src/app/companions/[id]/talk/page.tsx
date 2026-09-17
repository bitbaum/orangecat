/**
 * /companions/[id]/talk — the conversation as the page.
 *
 * Server-side: resolve the companion under the caller's own RLS (a stranger
 * cannot see a private one, so it 404s honestly), require sign-in with a
 * return path, then hand the room to the client.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { TalkRoom } from '@/components/companions/TalkRoom';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CompanionRow {
  id: string;
  title: string;
  welcome_message: string | null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .select('title')
    .eq('id', id)
    .maybeSingle();
  const title = (data as { title?: string } | null)?.title;
  return { title: title ? `Talk to ${title}` : 'Companion' };
}

export default async function CompanionTalkPage({ params }: PageProps) {
  const { id } = await params;
  const talkPath = `${ROUTES.AI_ASSISTANTS.VIEW(id)}/talk`;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(talkPath)}`);
  }

  const { data } = await supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .select('id, title, welcome_message')
    .eq('id', id)
    .maybeSingle();
  const companion = data as CompanionRow | null;
  if (!companion) {
    notFound();
  }

  return <TalkRoom companion={companion} />;
}
