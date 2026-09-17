'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { IMAGE_UPLOAD_ACCEPT, uploadUserImage } from '@/services/images/upload';
import type { StockImage } from '@/services/images/types';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/**
 * Own-photo upload for the shared image picker: click, drag & drop, or paste.
 * Oversized photos are downscaled client-side (see services/images/upload),
 * then handed back in the same StockImage shape the search/generate tabs use.
 */
export default function ImageUploadPanel({ onPick }: { onPick: (image: StockImage) => void }) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || busy || !user?.id) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await uploadUserImage(user.id, file, 'post-image');
    setBusy(false);
    if (!result.success || !result.url) {
      setError(apiErrorMessage(result, 'Upload failed. Please try again.'));
      return;
    }
    onPick({
      id: `upload-${Date.now()}`,
      thumbUrl: result.url,
      fullUrl: result.url,
      title: file.name.replace(/\.[^.]+$/, ''),
      creator: null,
      license: '',
      sourceUrl: null,
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={e => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={e => {
        e.preventDefault();
        setDragActive(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
      onPaste={e => {
        const file = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/'));
        if (file) {
          e.preventDefault();
          void handleFile(file);
        }
      }}
      aria-label="Upload an image — click, drag and drop, or paste"
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed py-8 text-center transition-colors',
        dragActive
          ? 'border-accent-warm bg-surface-raised/60'
          : 'border-default hover:border-interactive hover:bg-surface-raised/40',
        (busy || !user?.id) && 'pointer-events-none opacity-60'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="hidden"
        aria-label="Choose an image file"
        onChange={e => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {busy ? (
        <Loader2 className="h-6 w-6 animate-spin text-fg-tertiary" />
      ) : (
        <ImagePlus className="h-6 w-6 text-fg-tertiary" />
      )}
      <span className="text-sm font-medium text-fg-primary">
        {busy ? 'Uploading…' : 'Choose a photo'}
      </span>
      <span className="text-2xs text-fg-tertiary">
        Click, drag & drop, or paste · large photos are resized automatically
      </span>
      {error && <p className="px-4 text-xs text-status-negative">{error}</p>}
    </div>
  );
}
