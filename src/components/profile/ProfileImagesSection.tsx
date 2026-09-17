/**
 * ProfileImagesSection Component
 *
 * Handles avatar and banner image uploads for profile editing.
 * Extracted from ModernProfileEditor for better modularity.
 *
 * Created: 2025-01-28
 * Last Modified: 2025-01-28
 * Last Modified Summary: Extracted from ModernProfileEditor component
 */

import { User, Camera } from 'lucide-react';
import { Profile } from '@/types/profile';

interface ProfileImagesSectionProps {
  profile: Profile;
  avatarPreview: string | null;
  bannerPreview: string | null;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  bannerInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (file: File, type: 'avatar' | 'banner') => Promise<void>;
}

export function ProfileImagesSection({
  profile,
  avatarPreview,
  bannerPreview,
  avatarInputRef,
  bannerInputRef,
  handleFileUpload,
}: ProfileImagesSectionProps) {
  return (
    <div className="space-y-4">
      {/* Banner Upload */}
      <div className="relative">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload banner photo"
          className="relative h-32 bg-surface-raised rounded-lg border-2 border-dashed border-strong cursor-pointer overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => bannerInputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              bannerInputRef.current?.click();
            }
          }}
        >
          {bannerPreview || profile.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- src is a blob: object-URL preview or free-form banner_url (any host); next/image handles neither
            <img
              src={bannerPreview || profile.banner_url || ''}
              alt={`${profile.username || 'Profile'} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Camera
                  className="w-8 h-8 mx-auto text-fg-tertiary mb-2"
                  data-testid="camera-icon"
                />
                <p className="text-sm text-fg-secondary">Add banner photo</p>
              </div>
            </div>
          )}
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'banner')}
          className="hidden"
        />
      </div>

      {/* Avatar Upload */}
      <div className="flex items-start gap-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload profile photo"
          className="relative w-20 h-20 bg-surface-raised rounded-full border-2 border-strong cursor-pointer overflow-hidden flex-shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => avatarInputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              avatarInputRef.current?.click();
            }
          }}
        >
          {avatarPreview || profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- src is a blob: object-URL preview or free-form avatar_url (any host); next/image handles neither
            <img
              src={avatarPreview || profile.avatar_url || ''}
              alt={`${profile.username || 'Profile'} avatar`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <User className="w-8 h-8 text-fg-tertiary" data-testid="camera-icon" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center rounded-full">
            <Camera className="w-5 h-5 text-white opacity-0 hover:opacity-100" />
          </div>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'avatar')}
          className="hidden"
        />
      </div>
    </div>
  );
}
