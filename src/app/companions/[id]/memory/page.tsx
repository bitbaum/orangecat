/**
 * /companions/[id]/memory — what this companion remembers about you.
 * Sign-in required; the companion must be visible to you under RLS.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { MemoryList } from '@/components/companions/MemoryList';

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
  return { title: title ? `What ${title} remembers` : 'Companion memory' };
}

export default async function CompanionMemoryPage({ params }: PageProps) {
  const { id } = await params;
  const memoryPath = `${ROUTES.AI_ASSISTANTS.VIEW(id)}/memory`;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(memoryPath)}`);
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

  return <MemoryList companionId={companion.id} name={companion.title} />;
}
