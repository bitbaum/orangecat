import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getArticleBySlug } from '@/services/articles/get-article';
import { ROUTES } from '@/config/routes';
import ArticleComposer from '../../new/ArticleComposer';

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
    redirect(`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(`/articles/${slug}/edit`)}`);
  }

  const article = await getArticleBySlug(slug);

  // Only the author may edit (mutations are RLS-protected regardless).
  if (!article || user.id !== article.authorProfileId) {
    notFound();
  }

  return (
    <ArticleComposer
      key={`${user.id}:${article.id}`}
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
