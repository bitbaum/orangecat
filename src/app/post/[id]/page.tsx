import type { Metadata } from 'next';
import Button from '@/components/ui/Button';
import { APP_NAME, SITE_URL } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { buildPostMetadata, isPublicPost, postPreview, postUrl } from '@/lib/seo/post-metadata';
import { JsonLdScript } from '@/lib/seo/structured-data';
import { getPostForPage } from '@/services/timeline/get-post-preview.server';
import { postAuthHrefs } from './JoinToReply';
import PostThreadView from './PostThreadView';

/**
 * `/post/<id>` — one wall post and its thread, at the one URL people share.
 *
 * Readable signed out when the post is public. Who may see a post is the
 * database's rule (timeline_events RLS, read with the reader's own session in
 * getPostForPage); this page only renders what that read returned.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { post } = await getPostForPage(id);
  return buildPostMetadata(post, SITE_URL);
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const { post, viewerSignedIn } = await getPostForPage(id);

  if (!post) {
    return <PostUnavailable postId={id} signedIn={viewerSignedIn} />;
  }

  const jsonLd = isPublicPost(post.visibility)
    ? {
        '@context': 'https://schema.org',
        '@type': 'SocialMediaPosting',
        headline: postPreview(post).title,
        articleBody: post.text,
        ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
        author: { '@type': 'Person', name: post.authorName || post.authorUsername },
        url: postUrl(SITE_URL, post.id),
        publisher: { '@type': 'Organization', name: APP_NAME, url: SITE_URL },
      }
    : null;

  return (
    <>
      {jsonLd && <JsonLdScript data={jsonLd} />}
      <PostThreadView postId={post.id} viewerSignedIn={viewerSignedIn} />
    </>
  );
}

/**
 * Missing, deleted, or not shared with this reader — the database does not
 * say which, so neither does the page. Signed out, the likely case is a post
 * for its author's followers: signing in is the way forward, and it comes back.
 */
function PostUnavailable({ postId, signedIn }: { postId: string; signedIn: boolean }) {
  const { join, signIn } = postAuthHrefs(postId);
  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-fg-primary">
          {signedIn ? 'This post isn’t available' : 'Sign in to see this post'}
        </h1>
        <p className="mb-6 text-fg-secondary">
          {signedIn
            ? 'It may have been deleted, or its author shares it only with people who follow them.'
            : 'It may be shared only with the author’s followers, or it may have been deleted.'}
        </p>
        {signedIn ? (
          <Button href={ROUTES.TIMELINE}>Go to your timeline</Button>
        ) : (
          <div className="grid w-full grid-cols-2 gap-2">
            <Button href={signIn} size="lg" className="w-full">
              Sign in
            </Button>
            <Button href={join} variant="outline" size="lg" className="w-full">
              Join {APP_NAME}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
