import type { Profile } from '@/types/profile';

export const PROFILE_COMPLETION_FIELDS = [
  {
    label: 'Username',
    weight: 20,
    isComplete: (profile: Profile) => !!profile.username?.trim(),
  },
  {
    label: 'Name',
    weight: 10,
    isComplete: (profile: Profile) => !!profile.name?.trim(),
  },
  {
    label: 'Bio',
    weight: 15,
    isComplete: (profile: Profile) => !!profile.bio?.trim(),
  },
  {
    label: 'Current status',
    weight: 10,
    isComplete: (profile: Profile) => !!profile.current_status?.trim(),
  },
  {
    label: 'Ways others can help',
    weight: 10,
    isComplete: (profile: Profile) => !!profile.help_wanted?.length,
  },
  {
    label: 'Profile picture',
    weight: 10,
    isComplete: (profile: Profile) => !!profile.avatar_url?.trim(),
  },
  {
    label: 'Location',
    weight: 5,
    isComplete: (profile: Profile) =>
      !!(profile.location_search?.trim() || profile.location?.trim()),
  },
  {
    label: 'Website',
    weight: 5,
    isComplete: (profile: Profile) => !!profile.website?.trim(),
  },
  {
    label: 'Public contact email',
    weight: 5,
    isComplete: (profile: Profile) => !!profile.contact_email?.trim(),
  },
  {
    label: 'At least one social link',
    weight: 5,
    isComplete: (profile: Profile) =>
      !!(profile.social_links as { links?: unknown[] })?.links?.length,
  },
  {
    label: 'Phone number',
    weight: 5,
    isComplete: (profile: Profile) => !!profile.phone?.trim(),
  },
] as const;

export const getProfileMissingFields = (profile: Profile | null): string[] => {
  if (!profile) {
    return [];
  }
  return PROFILE_COMPLETION_FIELDS.filter(field => !field.isComplete(profile)).map(
    field => field.label
  );
};

export const getProfileCompletionPercentage = (profile: Profile | null): number => {
  if (!profile) {
    return 0;
  }
  const total = PROFILE_COMPLETION_FIELDS.length;
  const completed = PROFILE_COMPLETION_FIELDS.filter(field => field.isComplete(profile)).length;
  return Math.round((completed / total) * 100);
};
