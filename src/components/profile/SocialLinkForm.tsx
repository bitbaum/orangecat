'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SocialLink } from '@/types/social';
import {
  getPlatformById,
  getPredefinedPlatforms,
  type SocialPlatformId,
} from '@/lib/social-platforms';
import { X } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface SocialLinkFormProps {
  initialLink?: SocialLink;
  onSubmit: (link: SocialLink) => void;
  onCancel: () => void;
  existingPlatforms?: SocialPlatformId[];
}

export function SocialLinkForm({
  initialLink,
  onSubmit,
  onCancel,
  existingPlatforms = [],
}: SocialLinkFormProps) {
  const [platform, setPlatform] = useState<SocialPlatformId>(initialLink?.platform || 'x');
  const [label, setLabel] = useState(initialLink?.label || '');
  const [value, setValue] = useState(initialLink?.value || '');
  const [error, setError] = useState<string | null>(null);

  const platformConfig = getPlatformById(platform);
  const isCustom = platform === 'custom';
  const predefinedPlatforms = getPredefinedPlatforms();
  const availablePlatforms = predefinedPlatforms.filter(
    p => !existingPlatforms.includes(p.id) || (initialLink && p.id === initialLink.platform)
  );

  const handleSubmit = () => {
    setError(null);

    if (isCustom && !label.trim()) {
      setError('Platform name is required for custom links');
      return;
    }

    if (!value.trim()) {
      setError('Value is required');
      return;
    }

    if (platformConfig?.validation) {
      const validation = platformConfig.validation(value);
      if (!validation.valid) {
        setError(apiErrorMessage(validation, 'Invalid format'));
        return;
      }
    }

    if (isCustom) {
      try {
        new URL(value);
      } catch {
        setError('Please enter a valid URL');
        return;
      }
    }

    onSubmit({
      platform,
      label: isCustom ? label.trim() : undefined,
      value: value.trim(),
    });
  };

  const Icon = platformConfig?.icon || X;

  return (
    <div className="border dark:border-default rounded-lg p-4 bg-surface-base space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-fg-primary">
          {initialLink ? 'Edit Link' : 'Add Social Link'}
        </h4>
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="h-11 w-11 p-0"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <div className="oc-error-surface text-status-negative/80 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-2">Platform</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {availablePlatforms.map(p => {
            const PlatformIcon = p.icon;
            const isSelected = platform === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPlatform(p.id);
                  setError(null);
                }}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  isSelected
                    ? 'border-fg-primary bg-surface-raised/40'
                    : 'border-strong hover:border-strong'
                }`}
              >
                <div className="flex items-center gap-2">
                  <PlatformIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{p.label}</span>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setPlatform('custom');
              setError(null);
            }}
            className={`p-3 border rounded-lg text-left transition-colors ${
              platform === 'custom'
                ? 'border-fg-primary bg-surface-raised/40'
                : 'border-strong hover:border-strong'
            }`}
          >
            <div className="flex items-center gap-2">
              <X className="w-4 h-4" />
              <span className="text-sm font-medium">Custom</span>
            </div>
          </button>
        </div>
      </div>

      {isCustom && (
        <div>
          <label className="block text-sm font-medium text-fg-primary mb-2">Platform Name *</label>
          <Input
            value={label}
            onChange={e => {
              setLabel(e.target.value);
              setError(null);
            }}
            placeholder="e.g., YouTube, TikTok, OnlyFans"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-2">
          {isCustom ? 'URL *' : platformConfig?.label || 'Value'} *
        </label>
        <div className="relative">
          {platformConfig && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <Icon className="w-4 h-4 text-fg-tertiary" />
            </div>
          )}
          <Input
            value={value}
            onChange={e => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder={platformConfig?.placeholder || 'Enter URL or username'}
            className={platformConfig ? 'pl-10' : ''}
            required
          />
        </div>
        {platformConfig?.formatHint && (
          <p className="mt-1 text-xs text-fg-secondary">{platformConfig.formatHint}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} className="flex-1">
          {initialLink ? 'Save Changes' : 'Add Link'}
        </Button>
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}
