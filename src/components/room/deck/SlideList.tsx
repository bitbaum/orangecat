'use client';

import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import type { Deck } from '@bitbaum/deckkit';
import { Slide } from '@bitbaum/deckkit/react';
import Button from '@/components/ui/Button';

/**
 * The deck as thumbnails — each a real slide, drawn by the same renderer the
 * reader sees, at a fraction of the size. The selected one carries its tools.
 */
export function SlideList({
  deck,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
}: {
  deck: Deck;
  selected: number;
  onSelect: (index: number) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <ol className="space-y-3">
      {deck.slides.map((slide, i) => (
        <li key={slide.id}>
          <button
            type="button"
            onClick={() => onSelect(i)}
            aria-current={i === selected || undefined}
            className={`block w-full overflow-hidden rounded-md border-2 text-left transition-colors ${
              i === selected ? 'border-fg-primary' : 'border-transparent hover:border-border-subtle'
            }`}
          >
            <span className="sr-only">
              Slide {i + 1}: {slide.title.replace(/\*/g, '')}
            </span>
            <span aria-hidden className="pointer-events-none block">
              <Slide slide={slide} theme={deck.theme} />
            </span>
          </button>
          {i === selected && (
            <div className="mt-1 flex justify-between">
              <span className="self-center text-xs text-fg-muted">{i + 1}</span>
              <span className="flex">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => onMove(-1)}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Move down"
                  disabled={i === deck.slides.length - 1}
                  onClick={() => onMove(1)}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </Button>
                <Button variant="ghost" size="sm" aria-label="Duplicate" onClick={onDuplicate}>
                  <Copy className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete slide"
                  disabled={deck.slides.length <= 1}
                  onClick={onRemove}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
