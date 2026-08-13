import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getUserActorId } from '@/domain/actors';
import { getArticleBySlug } from '@/services/articles/get-article';
import { ROUTES } from '@/config/routes';
import ArticleComposer from '../../new/ArticleComposer';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditArticlePage({ params }: PageProps) {
  const { slug } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(authLoginPath(`/articles/${slug}/edit`));
  }

  const [article, actorId] = await Promise.all([
    getArticleBySlug(slug),
    getUserActorId(supabase, user.id),
  ]);

  // Only the author may edit (mutations are RLS-protected regardless).
  if (!article || !actorId || actorId !== article.authorActorId) {
    notFound();
  }

  return (
    <ArticleComposer
      user={{ id: user.id }}
      initial={{
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        coverImage: article.coverImage,
        body: article.body,
        visibility: article.visibility,
      }}
    />
  );
}
