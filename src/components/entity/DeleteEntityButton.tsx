'use client';

/**
 * Delete any entity from its own page, after a confirmation. Endpoint and the
 * page to return to both come from ENTITY_REGISTRY, so every type gets it from
 * one component. Before this an owner looking at their listing could edit it
 * but had to go back to the list to delete it.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
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
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface DeleteEntityButtonProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
}

export function DeleteEntityButton({ entityType, entityId, entityTitle }: DeleteEntityButtonProps) {
  const router = useRouter();
  const meta = ENTITY_REGISTRY[entityType];
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`${meta.apiEndpoint}/${entityId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(data, `Couldn't delete this ${meta.name.toLowerCase()}.`));
      }
      toast.success(`${meta.name} deleted`, { description: `"${entityTitle}" is gone.` });
      router.push(meta.basePath);
      router.refresh();
    } catch (err) {
      toast.error(`Couldn't delete this ${meta.name.toLowerCase()}`, {
        description: err instanceof Error ? err.message : undefined,
      });
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-status-negative hover:text-status-negative"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {meta.name.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{entityTitle}&rdquo; will be removed and its link will stop working. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-status-negative text-fg-inverted hover:bg-status-negative/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
