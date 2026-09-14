'use client';

import { useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Plus, ChevronUp, ChevronDown, GripVertical, Bot } from 'lucide-react';
import Button from '@/components/ui/Button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AIKeyCard } from './AIKeyCard';
import { AIKeyAddForm } from './AIKeyAddForm';
import type { AddKeyInput } from '@/data/aiProviders';

// Single definition lives with the service that owns the table.
export type { UserApiKey } from '@/services/ai/api-key-service';
import type { UserApiKey } from '@/services/ai/api-key-service';

/** The free OrangeCat default's position in the chain (sentinel id). */
import { buildChain, chainItemId, moveChainItem } from '@/services/ai/key-chain';

interface AIKeyManagerProps {
  keys: UserApiKey[];
  onAdd?: (data: AddKeyInput) => Promise<void>;
  onDelete?: (keyId: string) => Promise<void>;
  onSetPrimary?: (keyId: string) => Promise<void>;
  /** Persist a new fallback order — ids (first = tried earliest), incl. 'platform'. */
  onReorder?: (orderedIds: string[]) => Promise<void>;
  /** The platform default's position in the chain (0 = tried first). */
  platformPosition?: number;
  isLoading?: boolean;
  onFieldFocus?: (field: string | null) => void;
}

export function AIKeyManager({
  keys,
  onAdd,
  onDelete,
  onSetPrimary,
  onReorder,
  platformPosition = 0,
  isLoading = false,
  onFieldFocus,
}: AIKeyManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<UserApiKey | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDelete = async () => {
    if (!keyToDelete || !onDelete) {
      return;
    }
    try {
      await onDelete(keyToDelete.id);
      setKeyToDelete(null);
      toast.success('API key deleted');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete key');
    }
  };

  const handleAddSuccess = async (data: AddKeyInput) => {
    await onAdd?.(data);
    // The form owns its own success state — show the "Connected to X"
    // confirmation card instead of silently closing. The user dismisses
    // via "Add another key" or navigates away via "Start chatting."
  };

  const chain = buildChain(keys, platformPosition);

  // Move the chain item at `from` to slot `to`, then persist the new order.
  const reorderTo = async (from: number, to: number) => {
    if (!onReorder) {
      return;
    }
    const order = moveChainItem(chain, from, to);
    if (order) {
      await onReorder(order);
    }
  };

  const canReorder = !!onReorder && chain.length > 1;

  return (
    <div className="space-y-4">
      {keys.length > 0 && (
        <div className="space-y-3">
          {canReorder && (
            <p className="text-xs text-fg-secondary">
              Cat tries this chain top to bottom, skipping any link that fails or rate-limits. Drag
              (or use the arrows) to reorder — the free OrangeCat default can sit anywhere, even
              first.
            </p>
          )}
          {chain.map((it, index) => {
            const id = chainItemId(it);
            const rowProps = canReorder
              ? {
                  draggable: !isLoading,
                  onDragStart: () => setDragIndex(index),
                  onDragOver: (e: DragEvent) => e.preventDefault(),
                  onDrop: (e: DragEvent) => {
                    e.preventDefault();
                    if (dragIndex !== null) {
                      void reorderTo(dragIndex, index);
                    }
                    setDragIndex(null);
                  },
                  onDragEnd: () => setDragIndex(null),
                }
              : {};
            return (
              <div
                key={id}
                {...rowProps}
                className={`flex items-start gap-2 rounded-md ${
                  dragIndex === index ? 'opacity-50' : ''
                }`}
              >
                {canReorder && (
                  <div className="flex flex-col items-center gap-1 pt-3 text-fg-secondary">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0 || isLoading}
                      onClick={() => reorderTo(index, index - 1)}
                      className="rounded p-2 hover:text-fg-primary disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <GripVertical className="h-4 w-4 cursor-grab opacity-50" aria-hidden />
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === chain.length - 1 || isLoading}
                      onClick={() => reorderTo(index, index + 1)}
                      className="rounded p-2 hover:text-fg-primary disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex-1">
                  {it.kind === 'platform' ? (
                    <div className="rounded-md border border-subtle bg-surface-raised/30 p-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-fg-secondary" />
                        <p className="text-sm font-medium text-fg-primary">
                          OrangeCat free default
                        </p>
                        <span className="inline-flex items-center rounded-full border border-subtle bg-surface-page px-2 py-0.5 text-xs text-fg-secondary">
                          Always on
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-fg-secondary">
                        The shared free model pool. Can&apos;t be removed — it&apos;s the safety net
                        that keeps Cat answering.
                      </p>
                    </div>
                  ) : (
                    <AIKeyCard
                      apiKey={it.key}
                      isLoading={isLoading}
                      onSetPrimary={kid => onSetPrimary?.(kid)}
                      onDelete={setKeyToDelete}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdding ? (
        <AIKeyAddForm
          onAdd={handleAddSuccess}
          onCancel={() => setIsAdding(false)}
          onFieldFocus={onFieldFocus}
        />
      ) : (
        <Button
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="w-full justify-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add API Key
        </Button>
      )}

      <AlertDialog open={!!keyToDelete} onOpenChange={() => setKeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{keyToDelete?.key_name}&rdquo;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-status-negative px-6">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-status-negative text-fg-inverted hover:bg-status-negative/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AIKeyManager;
