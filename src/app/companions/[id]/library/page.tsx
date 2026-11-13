/**
 * /companions/[id]/library — the photos, files and links from your chats with this bot.
 * Sign-in required; the companion must be visible to you under RLS.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { LibraryList } from '@/components/companions/LibraryList';

interface PageProps {
  params: Promise<{ id: string }>;
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
  return { title: title ? `${title}: library` : 'Bot library' };
}

export default async function CompanionLibraryPage({ params }: PageProps) {
  const { id } = await params;
  const libraryPath = `${ROUTES.AI_ASSISTANTS.VIEW(id)}/library`;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(libraryPath)}`);
  }

  const { data } = await supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .select('id, title')
    .eq('id', id)
    .maybeSingle();
  const companion = data as { id: string; title: string } | null;
  if (!companion) {
    notFound();
  }

  return <LibraryList companionId={companion.id} name={companion.title} />;
}
