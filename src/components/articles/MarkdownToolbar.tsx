'use client';

import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Code,
} from 'lucide-react';
import type { MarkdownActions } from './useMarkdownTextarea';
import { cn } from '@/lib/utils';

/**
 * Formatting toolbar for the markdown article body. Purely drives
 * {@link MarkdownActions} — the body stays plain markdown (SSOT), rendered
 * safely by the bip-kit long-form pipeline. Design-token styling only.
 */
export default function MarkdownToolbar({
  actions,
  disabled,
}: {
  actions: MarkdownActions;
  disabled?: boolean;
}) {
  const btn =
    'flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40';

  const Divider = () => <span className="mx-0.5 h-5 w-px bg-subtle" aria-hidden />;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-subtle bg-surface-raised/30 px-1.5 py-1"
      role="toolbar"
      aria-label="Formatting"
    >
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.wrap('**', '**', 'bold')}
        title="Bold (⌘B)"
        aria-label="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.wrap('*', '*', 'italic')}
        title="Italic (⌘I)"
        aria-label="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.wrap('`', '`', 'code')}
        title="Inline code"
        aria-label="Inline code"
      >
        <Code className="h-4 w-4" />
      </button>
      <Divider />
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.prefixLines('## ')}
        title="Heading"
        aria-label="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.prefixLines('### ')}
        title="Subheading"
        aria-label="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </button>
      <Divider />
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.prefixLines('- ')}
        title="Bulleted list"
        aria-label="Bulleted list"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.prefixLines('1. ')}
        title="Numbered list"
        aria-label="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.prefixLines('> ')}
        title="Quote"
        aria-label="Quote"
      >
        <Quote className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btn)}
        disabled={disabled}
        onClick={() => actions.insertLink()}
        title="Link"
        aria-label="Link"
      >
        <Link2 className="h-4 w-4" />
      </button>
    </div>
  );
}
