'use client';

import React from 'react';
import Image from 'next/image';
import { Loader2, ImageIcon, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_FORMATS_LABEL } from '@/services/images/upload';
import type { ProofType } from './types';
import type { FieldError } from 'react-hook-form';

interface ProofImageUploadProps {
  selectedType: ProofType;
  imageUrl: string | null | undefined;
  isUploading: boolean;
  isDragging: boolean;
  uploadProgress: number;
  uploadError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageUrlError?: FieldError;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
}

export function ProofImageUpload({
  selectedType,
  imageUrl,
  isUploading,
  isDragging,
  uploadProgress,
  uploadError,
  fileInputRef,
  imageUrlError,
  onFileInputChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
}: ProofImageUploadProps) {
  return (
    <div className="space-y-2">
      <Label>{selectedType === 'receipt' ? 'Receipt Image' : 'Screenshot'}</Label>
      {imageUrl ? (
        <div className="relative h-48 w-full">
          <Image
            src={imageUrl}
            alt="Proof"
            fill
            sizes="(max-width: 640px) 100vw, 640px"
            className="rounded-lg object-cover"
          />
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="absolute top-2 right-2"
            onClick={onRemove}
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-fg-primary bg-fg-primary/5'
              : 'border-subtle hover:border-fg-secondary/50',
            isUploading && 'pointer-events-none opacity-60'
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            onChange={onFileInputChange}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="space-y-3">
              <Loader2 className="h-8 w-8 mx-auto text-fg-primary animate-spin" />
              <p className="text-sm font-medium">Uploading...</p>
              <div className="w-full max-w-xs mx-auto bg-surface-raised rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-fg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-fg-secondary">{uploadProgress}% complete</p>
            </div>
          ) : (
            <>
              <ImageIcon className="h-8 w-8 mx-auto text-fg-secondary mb-2" />
              <p className="text-sm font-medium mb-1">
                {isDragging ? 'Drop image here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-fg-secondary">{IMAGE_UPLOAD_FORMATS_LABEL}</p>
            </>
          )}
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-status-negative">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {imageUrlError && <p className="text-sm text-status-negative">{imageUrlError.message}</p>}
    </div>
  );
}
