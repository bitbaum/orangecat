import { Calendar, Globe, MapPin } from 'lucide-react';
import { isLocationHidden } from '@/lib/location-privacy';
import { APP_LOCALE } from '@/utils/locale';
import type { ScalableProfile } from '@/services/profile/types';

const JOINED_DATE_FORMATTER = new Intl.DateTimeFormat(APP_LOCALE, {
  month: 'short',
  year: 'numeric',
});

/** "Aug 2025" — quiet identity metadata, not a headline stat. */
function formatJoinedDate(createdAt: string): string | null {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : JOINED_DATE_FORMATTER.format(date);
}

/**
 * "Zurich, District Zurich, Zurich, Switzerland" (a geocoder's full path) reads
 * as "Zurich, Switzerland": the place and the country, nothing in between.
 */
export function shortLocationLabel(label: string): string {
  const parts = label
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts.join(', ');
}

/** "orangecat.ch" for "https://www.orangecat.ch/". */
export function websiteHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

type LocationFields = { location_search?: string | null; location_context?: string | null };

/**
 * The line under the name — handle, where, website, joined — the way every
 * social profile carries them. The website used to be a separate "Visit
 * Website" link under the offerings box and again an "Online presence" card on
 * Overview; location was only on the Info tab. One line, once.
 */
export function ProfileIdentityMeta({ profile }: { profile: ScalableProfile }) {
  const extra = profile as ScalableProfile & LocationFields;
  const rawLocation = isLocationHidden(extra.location_context || '')
    ? null
    : extra.location_search || profile.location;
  const location = rawLocation ? shortLocationLabel(rawLocation) : null;
  const joined = profile.created_at ? formatJoinedDate(profile.created_at) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
      {profile.username && (
        <span className="break-all font-medium text-fg-secondary">@{profile.username}</span>
      )}
      {location && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-fg-tertiary" aria-hidden />
          {location}
        </span>
      )}
      {profile.website && (
        <a
          href={profile.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-fg-primary underline-offset-4 hover:underline"
        >
          <Globe className="h-3.5 w-3.5 text-fg-tertiary" aria-hidden />
          {websiteHostLabel(profile.website)}
        </a>
      )}
      {joined && (
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-fg-tertiary" aria-hidden />
          Joined {joined}
        </span>
      )}
    </div>
  );
}
