'use client';

import Image from 'next/image';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import type { ScalableProfile } from '@/services/profile/types';

interface ProfileBannerSectionProps {
  profile: ScalableProfile;
}

/**
 * Banner + avatar. Nothing else sits on the photo: the actions used to float
 * over the banner, where they fought whatever image the owner chose and shrank
 * to four unlabelled icons on a phone. They live in the identity card now
 * (ProfileActions), next to the name they act on.
 */
export function ProfileBannerSection({ profile }: ProfileBannerSectionProps) {
  // The gap under the banner is NOT set here. The avatar hangs past the
  // banner's bottom edge, so whatever clears it has to know the overhang — and
  // that is the identity card in ProfileLayout, which the avatar overlaps.
  return (
    <div className="relative">
      <div className="relative h-32 sm:h-48 md:h-64 lg:h-80 bg-surface-raised border border-subtle rounded-lg sm:rounded-md shadow-none overflow-hidden">
        {profile.banner_url && (
          <Image
            src={profile.banner_url}
            alt=""
            fill
            sizes="(max-width: 1280px) 100vw, 1280px"
            priority
            className="object-cover"
          />
        )}
      </div>

      {/* Overhang is half the avatar at every breakpoint, and the horizontal
          inset matches the identity card's padding (p-4 sm:p-6) so the avatar
          and the name share one left edge. */}
      <div className="absolute z-10 -bottom-8 sm:-bottom-10 md:-bottom-12 lg:-bottom-16 left-4 sm:left-6">
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.name || profile.username || 'Profile photo'}
            width={128}
            height={128}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 rounded-lg object-cover border-2 sm:border-4 border-surface-page bg-surface-page shadow-sm"
          />
        ) : (
          <DefaultAvatar
            size={128}
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 rounded-lg border-2 sm:border-4 border-surface-page shadow-sm"
          />
        )}
      </div>
    </div>
  );
}
