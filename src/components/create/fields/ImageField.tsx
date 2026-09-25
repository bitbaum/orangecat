'use client';

/**
 * A form's photo: the picture itself once there is one, the shared upload
 * panel (click, drop or paste; downscaled client-side) until then. The value
 * is a public URL, which is what entity image columns hold.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import ImageUploadPanel from '@/components/images/ImageUploadPanel';

interface ImageFieldProps {
  value: unknown;
  onChange: (url: string | null) => void;
  label: string;
  disabled?: boolean;
}

export function ImageField({ value, onChange, label, disabled }: ImageFieldProps) {
  const url = typeof value === 'string' && value ? value : null;
  const [replacing, setReplacing] = useState(false);

  if (!url || replacing) {
    return (
      <ImageUploadPanel
        onPick={img => {
          onChange(img.fullUrl);
          setReplacing(false);
        }}
      />
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
