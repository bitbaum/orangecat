/**
 * The Cat's face. One, everywhere.
 *
 * The Cat was drawn three ways: the brand mark in a message thread, a "C" on
 * a grey plate in the new-message picker and on its share card, and the
 * placeholder kitten every picture-less profile gets on /profiles/cat and
 * while it is answering. The Cat IS the mark (the rings inside the head), so
 * its face is the brand's icon tile: the mark on the icon canvas, exactly as
 * the app icon carries it (`iconSvg`, src/lib/brand/mark-svg.ts), cropped
 * round like every other avatar. It is the same in light and dark, as an app
 * icon is.
 *
 * Where only a picture URL fits (a package's avatar slot, a share card), use
 * `CAT_AVATAR_PATH` / `avatarUrlFor` from config/cat-identity.ts: the same
 * drawing, as the generated static asset.
 */

import { BRAND_MARK } from '@/config/brand-mark';
import { CAT_DISPLAY_NAME } from '@/config/cat-identity';
import { iconSvg } from '@/lib/brand/mark-svg';
import { cn } from '@/lib/utils';

const CAT_FACE_SVG = iconSvg(BRAND_MARK, { maskable: true });

export interface CatAvatarProps {
  /** Fixed size in px. Leave it out to size by class. */
  size?: number;
  /** `rounded-full` by default; pass another radius where avatars are square. */
  className?: string;
}

export function CatAvatar({ size, className }: CatAvatarProps) {
  return (
    <span
      role="img"
      aria-label={CAT_DISPLAY_NAME}
      data-cat-avatar=""
      className={cn(
        'inline-block shrink-0 overflow-hidden rounded-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full',
        className
      )}
      style={size ? { width: size, height: size } : undefined}
      // Our own constant markup, built from the mark registry at module load.
      dangerouslySetInnerHTML={{ __html: CAT_FACE_SVG }}
    />
  );
}

export default CatAvatar;
