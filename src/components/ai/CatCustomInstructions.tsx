'use client';

/**
 * CatCustomInstructions — the user's standing instructions for their Cat.
 *
 * One textarea persisted to user_ai_preferences.custom_instructions and
 * injected into every Cat system prompt (src/services/cat/system-prompt.ts).
 * Instructions steer tone, language, and economic behavior; they never
 * override confirmation requirements or spend permissions.
 */

import { useEffect, useState } from 'react';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { MAX_CUSTOM_INSTRUCTIONS_LENGTH } from '@/services/cat/custom-instructions';

interface Props {
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
  isLoading?: boolean;
}

export function CatCustomInstructions({ value, onSave, isLoading }: Props) {
  const [draft, setDraft] = useState(value ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Adopt the server value once it arrives (or after an external refetch),
  // but never clobber an edit in progress.
  useEffect(() => {
    setDraft(prev => (prev === '' ? (value ?? '') : prev));
  }, [value]);

  const trimmed = draft.trim();
  const dirty = trimmed !== (value ?? '').trim();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(trimmed === '' ? null : trimmed);
      toast.success(trimmed === '' ? 'Instructions cleared' : 'Instructions saved');
    } catch {
      toast.error('Could not save instructions. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-default bg-surface-base p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-md bg-surface-raised p-2">
          <SlidersHorizontal className="h-5 w-5 text-fg-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-fg-primary">Custom instructions</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Standing instructions Cat follows in every conversation — tone, language, and how to
            handle your economic activity (e.g. &ldquo;prefer Lightning&rdquo;, &ldquo;never suggest
            loans&rdquo;, &ldquo;keep replies short&rdquo;). Cat still asks before anything spends
            money — instructions can&apos;t change that.
          </p>
        </div>
      </div>
      <Textarea
        label="Instructions for Cat"
        maxLength={MAX_CUSTOM_INSTRUCTIONS_LENGTH}
        value={draft}
        onChange={e => setDraft(e.target.value.slice(0, MAX_CUSTOM_INSTRUCTIONS_LENGTH))}
        disabled={isLoading || isSaving}
        rows={4}
        placeholder="e.g. Answer in German. Prices in CHF. I only offer services, never physical products."
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-fg-tertiary">
          {draft.length}/{MAX_CUSTOM_INSTRUCTIONS_LENGTH}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={handleSave}
          disabled={!dirty || isSaving || isLoading}
          className="px-5 py-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            'Save instructions'
          )}
        </Button>
      </div>
    </section>
  );
}
