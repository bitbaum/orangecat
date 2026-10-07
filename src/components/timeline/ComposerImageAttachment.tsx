'use client';

import { useCallback, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import ImageSuggestPicker from '@/components/images/ImageSuggestPicker';
import { uploadUserImage } from '@/services/images/upload';
import { toPostImageMeta, type PostImageMeta } from '@/types/timeline';
import type { StockImage } from '@/services/images/types';
import { TIMELINE_SURFACE } from '@/config/timeline';
import { cn } from '@/lib/utils';

/**
 * Everything image-attachment for the post composer: picker toggle state,
 * paste-upload flow, chip, preview, and picker panel. Extracted so
 * TimelineComposer stays a layout component.
 */
export function useComposerImage({
  userId,
  setImage,
}: {
  userId: string | undefined;
  setImage: (image: PostImageMeta | null) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  const handlePick = useCallback(
    (img: StockImage) => {
      setImage(toPostImageMeta(img));
      setShowPicker(false);
    },
    [setImage]
  );

  // Pasting a screenshot/photo into the editor attaches it directly —
  // zero clicks, same upload path as the picker's Upload tab.
  const handlePasteFiles = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || !userId || isPasting) {
        return;
      }
      setIsPasting(true);
      const result = await uploadUserImage(userId, file, 'post-image');
      setIsPasting(false);
      if (result.success && result.url) {
        setImage(
          toPostImageMeta({
            fullUrl: result.url,
            title: file.name.replace(/\.[^.]+$/, ''),
            creator: null,
            license: '',
            sourceUrl: null,
          })
        );
      } else {
        // A paste has no picker to show an error in, so a failure used to vanish:
        // the spinner stopped and nothing was attached, with no reason given.
        toast.error(apiErrorMessage(result, 'Could not attach that image.'));
      }
    },
    [userId, setImage, isPasting]
  );

  return {
    showPicker,
    isPasting,
    togglePicker: () => setShowPicker(v => !v),
    closePicker: () => setShowPicker(false),
    handlePick,
    handlePasteFiles,
  };
}

export function ComposerImageChip({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(TIMELINE_SURFACE.chip, active && TIMELINE_SURFACE.chipActive, 'gap-1.5')}
      title="Add an image — search free photos, generate, or upload"
      aria-expanded={active}
    >
      <ImagePlus className="h-4 w-4" />
      Image
    </button>
  );
}

export function ComposerImageAttachment({
  image,
  isPasting,
  showPicker,
  content,
  disabled,
  onPick,
  onRemove,
  onClosePicker,
}: {
  image: PostImageMeta | null;
  isPasting: boolean;
  showPicker: boolean;
  content: string;
  disabled: boolean;
  onPick: (img: StockImage) => void;
  onRemove: () => void;
  onClosePicker: () => void;
}) {
  return (
    <>
      {isPasting && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-fg-tertiary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Adding photo…
        </div>
      )}

      {image && (
        <div className="relative mt-3 inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- may be an external (Openverse) host, not in next/image remotePatterns */}
          <img
            src={image.url}
            alt={image.alt}
            className="max-h-56 max-w-full rounded-lg border border-subtle object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove image"
            className="absolute right-2 top-2 min-h-11 min-w-11 flex items-center justify-center rounded-full border border-subtle bg-surface-base/90 p-1 text-fg-primary transition-colors hover:bg-surface-base"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showPicker && !image && (
        <div className="mt-3">
          <ImageSuggestPicker
            title=""
            body={content}
            heading="Add an image"
            onPick={onPick}
            onClose={onClosePicker}
          />
        </div>
      )}
    </>
  );
}
