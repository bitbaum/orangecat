'use client';

/**
 * A form's photo: the picture itself once there is one, the shared upload
 * panel (click, drop or paste; downscaled client-side) until then — and, for
 * someone without a photo, the shared picker that finds an openly licensed
 * one or generates one with their own AI key. Every entity form with an image
 * field gets all three. The value is a public URL, which is what entity image
 * columns hold.
 */

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import ImageUploadPanel from '@/components/images/ImageUploadPanel';
import ImageSuggestPicker from '@/components/images/ImageSuggestPicker';

interface ImageFieldProps {
  value: unknown;
  onChange: (url: string | null) => void;
  label: string;
  disabled?: boolean;
  /** The entity so far: the picker searches for it, not for the field's name. */
  subject?: { title?: string; description?: string } | undefined;
}

export function ImageField({ value, onChange, label, disabled, subject }: ImageFieldProps) {
  const url = typeof value === 'string' && value ? value : null;
  const [replacing, setReplacing] = useState(false);
  const [picking, setPicking] = useState(false);
  const pick = (fullUrl: string) => {
    onChange(fullUrl);
    setReplacing(false);
    setPicking(false);
  };

  if (picking) {
    return (
      <ImageSuggestPicker
        title={subject?.title?.trim() || label}
        body={subject?.description ?? ''}
        heading={`Choose a ${label.toLowerCase()}`}
        onPick={img => pick(img.fullUrl)}
        onClose={() => setPicking(false)}
      />
    );
  }

  if (!url || replacing) {
    return (
      <div className="space-y-2">
        <ImageUploadPanel onPick={img => pick(img.fullUrl)} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPicking(true)}
          className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-fg-primary underline-offset-2 hover:underline"
        >
          <Sparkles className="h-4 w-4" /> No photo? Find or generate one
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {/* Public storage URL; next/image would need every host allow-listed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="h-32 w-32 flex-shrink-0 rounded-lg border border-subtle object-cover"
      />
      <div className="flex flex-col gap-2 text-sm">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setReplacing(true)}
          className="text-left font-medium text-fg-primary underline-offset-2 hover:underline"
        >
          Replace photo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="flex items-center gap-1 text-left text-fg-secondary hover:text-status-negative"
        >
          <X className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </div>
  );
}
