'use client';

/**
 * A deck, presented. Full screen, 16:9, keyboard / swipe / click; `#3` opens
 * slide 3 and the address follows as you move, so one slide can be linked.
 * Every slide stays in the document — hidden but present — so "Save as PDF"
 * prints the whole deck as real, selectable text, one page per slide.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Slide } from './Slide';
import type { Deck } from '../types';

export interface DeckPresenterProps {
  /** Already bound to live data (bindDeck) and normalised. */
  deck: Deck;
  /** Speaker notes on S. Off for a reader; on for whoever presents. */
  allowNotes?: boolean;
  /** Called with the slide id whenever the shown slide changes. */
  onSlideChange?: (slideId: string, index: number) => void;
  /** Extra controls in the bar (a "Back to the room" link, say). */
  extraControls?: ReactNode;
}

function indexFromHash(count: number): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  const n = Number.parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(n) && n >= 1 && n <= count ? n - 1 : 0;
}

export function DeckPresenter({
  deck,
  allowNotes,
  onSlideChange,
  extraControls,
}: DeckPresenterProps) {
  const count = deck.slides.length;
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback((to: number) => setIndex(Math.min(count - 1, Math.max(0, to))), [count]);

  // Start where the address says, and follow the address back/forward. The
  // address is never WRITTEN until it has been read once: otherwise the first
  // render's slide 1 overwrites "#9" before anything reads it.
  const [hashRead, setHashRead] = useState(false);
  useEffect(() => {
    setIndex(indexFromHash(count));
    setHashRead(true);
    const onHash = () => setIndex(indexFromHash(count));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [count]);

  useEffect(() => {
    const slide = deck.slides[index];
    if (!slide || !hashRead) {
      return;
    }
    if (window.location.hash !== `#${index + 1}`) {
      window.history.replaceState(null, '', `#${index + 1}`);
    }
    onSlideChange?.(slide.id, index);
  }, [index, hashRead, deck.slides, onSlideChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        return;
      }
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          go(index + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          go(index - 1);
          break;
        case 'Home':
          go(0);
          break;
        case 'End':
          go(count - 1);
          break;
        case 'f':
        case 'F':
          void toggleFullscreen(rootRef.current);
          break;
        case 's':
        case 'S':
          if (allowNotes) {
            setNotes(n => !n);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, go, allowNotes]);

  const current = deck.slides[index];

  return (
    <div
      ref={rootRef}
      className="dk-presenter"
      style={{ ['--dk-accent' as string]: deck.theme.accent }}
      onTouchStart={e => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={e => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < 50) {
          return;
        }
        go(end < start ? index + 1 : index - 1);
      }}
    >
      <div className="dk-progress" style={{ width: `${((index + 1) / count) * 100}%` }} />
      <div
        className="dk-stage dk-print-all"
        onClick={e => {
          if ((e.target as HTMLElement).closest('a')) {
            return;
          }
          const box = e.currentTarget.getBoundingClientRect();
          go(e.clientX - box.left < box.width * 0.28 ? index - 1 : index + 1);
        }}
      >
        {deck.slides.map((slide, i) => (
          <Slide
            key={slide.id}
            slide={slide}
            theme={deck.theme}
            hidden={i !== index}
            animate={i === index}
          />
        ))}
      </div>

      {notes && current?.notes && <div className="dk-notes">{current.notes}</div>}

      <div className="dk-chrome">
        <span aria-live="polite">
          {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </span>
        <span>
          {extraControls}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            disabled={index === 0}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            disabled={index === count - 1}
          >
            →
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen(rootRef.current)}
            aria-label="Full screen"
          >
            ⛶
          </button>
          <button type="button" onClick={() => window.print()} aria-label="Save as PDF">
            PDF
          </button>
        </span>
      </div>
    </div>
  );
}

async function toggleFullscreen(el: HTMLElement | null) {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el?.requestFullscreen();
    }
  } catch {
    // Not allowed here (an iframe, an old browser): the deck still works.
  }
}
