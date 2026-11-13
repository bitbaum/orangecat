/**
 * Who the money goes to: face, name, @handle.
 *
 * One block for both ends of the same link. Receive draws it above the code
 * you show; the pay page draws it above the amount the payer types. A payer
 * who only sees a display name cannot tell "Anna" from any other Anna, and the
 * person sharing the code should recognise exactly what the payer will see.
 */

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitial } from '@/utils/string';
import { cn } from '@/lib/utils';

interface PayeeIdentityProps {
  name: string;
  username: string;
  avatarUrl?: string | null;
  /** Makes the @handle a link (the public profile). Omit to show it as text. */
  profileHref?: string;
  /** Renders the name as the page's h1 (the pay page) rather than a line of text. */
  asHeading?: boolean;
  className?: string;
}

const NAME_CLASS =
  'mb-0 mt-3 font-heading text-xl font-semibold leading-tight tracking-display text-fg-primary';

export function PayeeIdentity({
  name,
  username,
  avatarUrl,
  profileHref,
  asHeading = false,
  className,
}: PayeeIdentityProps) {
  const NameTag = asHeading ? 'h1' : 'p';
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <Avatar className="h-12 w-12">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-lg font-semibold text-fg-secondary">
          {getInitial(name)}
        </AvatarFallback>
      </Avatar>
      <NameTag className={NAME_CLASS}>{name}</NameTag>
      {profileHref ? (
        <Link
          href={profileHref}
          className="inline-flex min-h-11 items-center text-sm text-fg-secondary underline-offset-2 hover:underline"
        >
          @{username}
        </Link>
      ) : (
        <p className="mb-0 text-sm text-fg-secondary">@{username}</p>
      )}
    </div>
  );
}
