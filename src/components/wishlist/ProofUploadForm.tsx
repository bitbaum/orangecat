'use client';

import React from 'react';
import { Bitcoin, Upload, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ProofUploadFormProps, ProofType } from './types';
import { PROOF_TYPE_META } from './types';
import { useProofUploadForm } from './useProofUploadForm';
import { ProofImageUpload } from './ProofImageUpload';

const PROOF_TYPE_OPTIONS = (Object.keys(PROOF_TYPE_META) as ProofType[]).map(value => ({
  value,
  icon: PROOF_TYPE_META[value].icon,
  label: PROOF_TYPE_META[value].label,
  description: PROOF_TYPE_META[value].description,
}));

export function ProofUploadForm({
  wishlistItemId,
  onSuccess,
  onCancel,
  className,
}: ProofUploadFormProps) {
  const {
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
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleImageRemove,
    onSubmit,
  } = useProofUploadForm({ wishlistItemId, onSuccess });

  return (
    <Card className={cn('p-4', className)}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('wishlist_item_id')} />

        <div className="space-y-2">
          <Label>Proof Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {PROOF_TYPE_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTypeSelect(option.value)}
                  className={cn(
                    'flex flex-col items-center p-3 rounded-lg border-2 transition-colors',
                    'hover:bg-surface-raised/50',
                    selectedType === option.value
                      ? 'border-fg-primary bg-fg-primary/5'
                      : 'border-subtle'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 mb-1',
                      selectedType === option.value ? 'text-fg-primary' : 'text-fg-secondary'
                    )}
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-fg-secondary text-center">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.proof_type && (
            <p className="text-sm text-status-negative">{errors.proof_type.message}</p>
          )}
        </div>

        {selectedType && (
          <>
            {proofMeta?.requiresImage && (
              <ProofImageUpload
                selectedType={selectedType}
                imageUrl={imageUrl}
                isUploading={isUploading}
                isDragging={isDragging}
                uploadProgress={uploadProgress}
                uploadError={uploadError}
                fileInputRef={fileInputRef}
                imageUrlError={errors.image_url}
                onFileInputChange={handleFileInputChange}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onRemove={handleImageRemove}
              />
            )}

            {proofMeta?.requiresTransaction && (
              <div className="space-y-2">
                <Label htmlFor="transaction_id">Transaction ID</Label>
                <div className="flex items-center gap-2">
                  <Bitcoin className="h-5 w-5 text-bitcoinOrange shrink-0" />
                  <Input
                    id="transaction_id"
                    {...register('transaction_id')}
                    placeholder="Enter Bitcoin transaction ID..."
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-fg-secondary">
                  The transaction ID can be found in your wallet or on a block explorer
                </p>
                {errors.transaction_id && (
                  <p className="text-sm text-status-negative">{errors.transaction_id.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe how you used the funds..."
                rows={3}
              />
              <p className="text-xs text-fg-secondary">Minimum 10 characters required</p>
              {errors.description && (
                <p className="text-sm text-status-negative">{errors.description.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Post Proof
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </form>
    </Card>
  );
}
