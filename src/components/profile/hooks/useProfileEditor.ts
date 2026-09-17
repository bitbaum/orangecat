import { useState, useRef, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Profile } from '@/types/profile';
import { ProfileFormData } from '@/types/database';
import { parseLocationContext, type LocationMode } from '@/lib/location-privacy';
import { ProfileStorageService } from '@/services/profile/storage';
import { SocialLink } from '@/types/social';
import { profileSchema as serverProfileSchema } from '@/lib/validation';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import type { MakerStatus, HelpWantedOption } from '@/config/maker-status';
import { ProfileFieldType } from '@/lib/profile-guidance';
import { submitProfileForm } from './profileSubmitHandler';
import type { ProfileFormValues } from '../types';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const profileSchema = serverProfileSchema;

export interface UseProfileEditorOptions {
  profile: Profile;
  userId: string;
  userEmail?: string;
  onSave: (data: ProfileFormData) => Promise<void>;
  onCancel: () => void;
  onFieldFocus?: (field: ProfileFieldType) => void;
}

export interface UseProfileEditorReturn {
  form: ReturnType<typeof useForm<ProfileFormValues>>;
  isSaving: boolean;
  avatarPreview: string | null;
  bannerPreview: string | null;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (file: File, type: 'avatar' | 'banner') => Promise<void>;
  socialLinks: SocialLink[];
  setSocialLinks: React.Dispatch<React.SetStateAction<SocialLink[]>>;
  locationMode: LocationMode;
  setLocationMode: React.Dispatch<React.SetStateAction<LocationMode>>;
  locationGroupLabel: string;
  setLocationGroupLabel: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (data: ProfileFormValues) => Promise<void>;
}

export function useProfileEditor({
  profile,
  userId,
  userEmail,
  onSave,
  onCancel,
  onFieldFocus: _onFieldFocus,
}: UseProfileEditorOptions): UseProfileEditorReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile.social_links) {
      if (typeof profile.social_links === 'object' && 'links' in profile.social_links) {
        setSocialLinks((profile.social_links as { links: SocialLink[] }).links || []);
      } else if (Array.isArray(profile.social_links)) {
        setSocialLinks(profile.social_links as SocialLink[]);
      }
    }
  }, [profile.social_links]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      // No email fallback: username is NOT NULL and always set by a creation
      // path, so this only ever fired on a half-loaded profile — and when it
      // did it pre-filled the PUBLIC handle field with the user's email local
      // part, one Save away from publishing it.
      username: profile.username || '',
      name: profile.name || '',
      bio: profile.bio || '',
      location_country: profile.location_country || '',
      location_city: profile.location_city || '',
      location_zip: profile.location_zip || '',
      location_search: profile.location_search || profile.location || '',
      latitude: profile.latitude || undefined,
      longitude: profile.longitude || undefined,
      location_context: profile.location_context || '',
      location: profile.location || '',
      avatar_url: profile.avatar_url || '',
      banner_url: profile.banner_url || '',
      website: profile.website || '',
      social_links: socialLinks.length > 0 ? { links: socialLinks } : undefined,
      contact_email: profile.contact_email || userEmail || '',
      phone: profile.phone || '',
      bitcoin_address: profile.bitcoin_address || '',
      lightning_address: profile.lightning_address || '',
      currency: (profile.currency as typeof PLATFORM_DEFAULT_CURRENCY) || PLATFORM_DEFAULT_CURRENCY,
      privacy_settings:
        (profile.privacy_settings as { hidden_fields?: string[] } | null | undefined) ?? undefined,
      current_status: (profile.current_status as MakerStatus) || '',
      help_wanted: (profile.help_wanted as HelpWantedOption[]) || [],
    },
  });

  const watchedUsername = form.watch('username');
  const watchedDisplayName = form.watch('name');

  const [locationMode, setLocationMode] = useState<LocationMode>(
    () => parseLocationContext(profile.location_context || '').mode
  );
  const [locationGroupLabel, setLocationGroupLabel] = useState<string>(() => {
    const parsed = parseLocationContext(profile.location_context || '');
    return parsed.groupLabel || '';
  });

  useEffect(() => {
    if (watchedUsername && !watchedDisplayName) {
      form.setValue('name', watchedUsername);
    }
  }, [watchedUsername, watchedDisplayName, form]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel, isSaving]);

  const handleFileUpload = async (file: File, type: 'avatar' | 'banner') => {
    if (!userId) {
      toast.error('You must be logged in to upload files');
      return;
    }
    const setPreview = type === 'avatar' ? setAvatarPreview : setBannerPreview;
    try {
      setPreview(URL.createObjectURL(file));
      const result = await (type === 'avatar'
        ? ProfileStorageService.uploadAvatar(userId, file)
        : ProfileStorageService.uploadBanner(userId, file));
      if (result.success && result.url) {
        form.setValue(`${type}_url` as keyof ProfileFormValues, result.url);
        setPreview(result.url);
      } else {
        throw new Error(apiErrorMessage(result, 'Upload failed'));
      }
    } catch (error) {
      setPreview(null);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    form.setValue('social_links', socialLinks.length > 0 ? { links: socialLinks } : undefined);
  }, [socialLinks, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    await submitProfileForm({
      data,
      socialLinks,
      locationMode,
      locationGroupLabel,
      setIsSaving,
      onSave,
    });
  };

  return {
    form: form as ReturnType<typeof useForm<ProfileFormValues>>,
    isSaving,
    avatarPreview,
    bannerPreview,
    avatarInputRef,
    bannerInputRef,
    handleFileUpload,
    socialLinks,
    setSocialLinks,
    locationMode,
    setLocationMode,
    locationGroupLabel,
    setLocationGroupLabel,
    onSubmit,
  };
}
