'use client';

import { Sparkles, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { AIAssistChip } from './AIAssistChip';
import { DictationButton } from '@/components/ui/DictationButton';
import { FEATURES } from '@/config/features';

interface AIFillPanelProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  /** Starter descriptions for this entity type — tap instead of composing */
  examples: string[];
  onSubmit: () => void;
  busy: boolean;
  disabled: boolean;
}

/**
 * The empty-form surface: describe what you want, AI fills the fields.
 *
 * Speaking and typing are the same act here, so they share one control. The
 * mic used to sit beside every individual field, which put a microphone icon
 * on half the form and made voice look like a property of text inputs rather
 * than a way to talk to the AI. There is one AI entry point per form and the
 * mic belongs in it — same arrangement as the Cat composer (input above,
 * actions bottom-right), so the two read as the same tool.
 *
 * Mobile-first ordering — the textarea is the ask, examples are the shortcut
 * for anyone who does not want to compose from scratch, and the actions sit in
 * one row so the primary CTA is never a thumb-stretch to the corner.
 */
export function AIFillPanel({
  description,
  onDescriptionChange,
  examples,
  onSubmit,
  busy,
  disabled,
}: AIFillPanelProps) {
  const isBlocked = busy || disabled;

  return (
    <div className="space-y-3">
      <textarea
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Describe or dictate what you want to create — AI fills the form for you."
        disabled={isBlocked}
        rows={3}
        // text-base on mobile: anything smaller makes iOS zoom in on focus
        className="block w-full resize-none rounded-md border border-subtle bg-surface-page px-3 py-2 text-base placeholder:text-fg-tertiary focus:border-interactive focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 sm:text-sm"
      />

      {examples.length > 0 && !description && (
        <div className="space-y-2">
          <p className="text-xs text-fg-secondary">Or start from an example:</p>
          <div className="flex flex-wrap gap-2">
            {examples.slice(0, 2).map(example => (
              <AIAssistChip
                key={example}
                label={example}
                block
                disabled={isBlocked}
                onClick={() => onDescriptionChange(example)}
              />
            ))}
          </div>
        </div>
      )}

      {/* One row, actions right: dictate into the same box you would type in,
          then fill. Matches the Cat composer's mic-then-send ordering. */}
      <div className="flex items-center justify-end gap-2">
        {FEATURES.voiceInput && (
          <DictationButton
            size="sm"
            disabled={isBlocked}
            ariaLabel="Dictate what you want to create"
            onTranscript={t =>
              onDescriptionChange(description.trim().length ? `${description} ${t}` : t)
            }
          />
        )}
        <Button
          type="button"
          size="lg"
          onClick={onSubmit}
          disabled={isBlocked || !description.trim()}
          className="flex-1 gap-2 sm:flex-none"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span>{busy ? 'Filling form…' : 'Fill form'}</span>
        </Button>
      </div>
    </div>
  );
}

export default AIFillPanel;
