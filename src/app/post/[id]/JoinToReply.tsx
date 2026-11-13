import Button from '@/components/ui/Button';
import { APP_NAME } from '@/config/brand';
import { ROUTES } from '@/config/routes';

/** Sign-in and sign-up links that land back on this post. */
export function postAuthHrefs(postId: string): { join: string; signIn: string } {
  const from = encodeURIComponent(ROUTES.POST(postId));
  return {
    join: `${ROUTES.AUTH_REGISTER}&from=${from}`,
    signIn: `${ROUTES.AUTH_LOGIN}&from=${from}`,
  };
}

/**
 * Where a signed-out reader would find the reply box: the way in. This is the
 * growth loop — a post shared to X or WhatsApp is how most people first meet
 * OrangeCat — so the page that opens from the link says what joining gets them
 * and comes back here afterwards.
 */
export function JoinToReply({ postId, authorName }: { postId: string; authorName: string }) {
  const { join, signIn } = postAuthHrefs(postId);
  const who = authorName.trim() || 'This author';
  return (
    <section className="border-b border-default px-4 py-5" aria-label={`Write on ${APP_NAME}`}>
      <p className="mb-0 font-semibold text-fg-primary">
        {who} writes on {APP_NAME}.
      </p>
      <p className="mb-0 mt-1 text-sm text-fg-secondary">
        Join to reply, follow them and publish your own posts and articles. It is free.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button href={join} variant="accent" size="lg" className="w-full">
          Join {APP_NAME}
        </Button>
        <Button href={signIn} variant="outline" size="lg" className="w-full">
          Sign in
        </Button>
      </div>
    </section>
  );
}
