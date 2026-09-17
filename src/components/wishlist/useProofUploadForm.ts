'use client';

import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import {
  wishlistFulfillmentProofSchema,
  type WishlistFulfillmentProofFormData,
} from '@/lib/validation';
import type { ProofType, FulfillmentProof } from './types';
import { PROOF_TYPE_META } from './types';
import { ProofStorageService } from '@/services/wishlist';
import type { FileUploadProgress } from '@/types/storage';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface UseProofUploadFormParams {
  wishlistItemId: string;
  onSuccess?: (proof: FulfillmentProof) => void;
}

export function useProofUploadForm({ wishlistItemId, onSuccess }: UseProofUploadFormParams) {
  const [selectedType, setSelectedType] = useState<ProofType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<WishlistFulfillmentProofFormData>({
    resolver: zodResolver(wishlistFulfillmentProofSchema),
    defaultValues: {
      wishlist_item_id: wishlistItemId,
      proof_type: undefined,
      description: '',
      image_url: null,
      transaction_id: null,
    },
  });

  const imageUrl = watch('image_url');
  const proofMeta = selectedType ? PROOF_TYPE_META[selectedType] : null;

  const handleTypeSelect = (type: ProofType) => {
    setSelectedType(type);
    setValue('proof_type', type);
    setUploadError(null);
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!selectedType || (selectedType !== 'receipt' && selectedType !== 'screenshot')) {
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      const result = await ProofStorageService.uploadProofImage(
        wishlistItemId,
        file,
        selectedType,
        (progress: FileUploadProgress) => {
          setUploadProgress(progress.percentage);
        }
      );

      setIsUploading(false);

      if (result.success && result.url) {
        setValue('image_url', result.url);
        setUploadProgress(100);
      } else {
        setUploadError(apiErrorMessage(result, 'Failed to upload image'));
        setUploadProgress(0);
      }
    },
    [wishlistItemId, selectedType, setValue]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleFileUpload(file);
      } else {
        setUploadError('Please drop an image file (JPEG, PNG, WebP, or GIF)');
      }
    },
    [handleFileUpload]
  );

  const handleImageRemove = () => {
    setValue('image_url', null);
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: WishlistFulfillmentProofFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.WISHLISTS.PROOFS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to upload proof');
      }

      const result = await response.json();
      reset();
      setSelectedType(null);
      onSuccess?.(result.data);
    } catch (error) {
      logger.error('Error uploading proof', error, 'Wishlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    selectedType,
    isSubmitting,
    isUploading,
    uploadProgress,
    uploadError,
    isDragging,
    fileInputRef,
    imageUrl,
    proofMeta,
    register,
    handleSubmit,
    errors,
    handleTypeSelect,
    handleFileUpload,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleImageRemove,
    onSubmit,
  };
}
