'use client';

/**
 * The owner's deck editor (@bitbaum/deckkit). A deck starts as a draft
 * generated from the room — nothing invented — and every slide is then the
 * owner's to change. The preview is the reader's renderer, fed the same live
 * data, so what you see here is what an investor sees.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Play, Plus, Sparkles, X } from 'lucide-react';
import {
  bindDeck,
  generateDeck,
  LAYOUTS,
  type Deck,
  type DeckData,
  type DeckSource,
  type Layout,
} from '@bitbaum/deckkit';
import { DeckPresenter, Slide } from '@bitbaum/deckkit/react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { SlideForm } from './SlideForm';
import { SlideList } from './SlideList';
import {
  LAYOUT_LABELS,
  blankSlide,
  duplicateSlide,
  insertSlide,
  moveSlide,
  removeSlide,
  updateSlide,
} from './deckEdits';

interface DeckEditorProps {
  projectId: string;
  projectTitle: string;
  initialDeck: Deck | null;
  source: DeckSource;
  data: DeckData;
}

export function DeckEditor({
  projectId,
  projectTitle,
  initialDeck,
  source,
  data,
}: DeckEditorProps) {
  const [deck, setDeck] = useState<Deck | null>(initialDeck);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [newLayout, setNewLayout] = useState<Layout>('statement');
  const bound = useMemo(() => (deck ? bindDeck(deck, data) : null), [deck, data]);

  function change(next: { deck: Deck; index: number } | Deck) {
    if ('slides' in next) {
      setDeck(next);
    } else {
      setDeck(next.deck);
      setSelected(next.index);
    }
    setDirty(true);
  }

  function generate() {
    setDeck(generateDeck(source, data));
    setSelected(0);
    setDirty(true);
    setConfirmRegenerate(false);
    toast.success('A first draft, from the room. Every slide is yours to change.');
  }

  async function save() {
    if (!deck) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(API_ROUTES.PROJECTS.ROOM_DECK(projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deck),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error?.message ?? 'Could not save the deck');
        return;
      }
      if (body?.data) {
        setDeck(body.data as Deck);
      }
      setDirty(false);
      toast.success('Deck saved — it is in the room now');
    } finally {
      setSaving(false);
    }
  }

  const back = (
    <Link
      href={ROUTES.PROJECTS.ROOM(projectId)}
      className="inline-flex min-h-11 items-center gap-1 text-sm text-fg-secondary hover:text-fg-primary"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {projectTitle} · Investor room
    </Link>
  );

  if (!deck || !bound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        {back}
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-display text-fg-primary">
          Deck
        </h1>
        <p className="mt-3 text-base leading-relaxed text-fg-secondary">
          A presentation made from this room: the problem, the solution, live proof that it is real
          and moving, your own sections, the numbers, the roadmap and the ask — one claim per slide.
          Nothing is invented: every word comes from the room, and the proof slides read live data
          each time the deck is opened. Then change anything you like.
        </p>
        <Button variant="accent" size="lg" className="mt-6" onClick={generate}>
          <Sparkles className="h-4 w-4" aria-hidden />
          Generate a first draft from this room
        </Button>
      </div>
    );
  }

  const slide = deck.slides[selected] ?? deck.slides[0]!;
  const preview = bound.slides[selected] ?? bound.slides[0]!;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Theme"
            className="min-h-11 rounded-md border border-border-subtle bg-surface-base px-3 text-sm text-fg-primary"
            value={deck.theme.mode}
            onChange={e =>
              change({
                ...deck,
                theme: { ...deck.theme, mode: e.target.value as 'dark' | 'light' },
              })
            }
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
          <label className="flex min-h-11 items-center gap-2 text-sm text-fg-secondary">
            Accent
            <input
              type="color"
              className="h-8 w-10 cursor-pointer rounded border border-border-subtle bg-transparent"
              value={deck.theme.accent}
              onChange={e => change({ ...deck, theme: { ...deck.theme, accent: e.target.value } })}
            />
          </label>
          {confirmRegenerate ? (
            <Button variant="danger" onClick={generate}>
              Replace with a new draft
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirmRegenerate(true)}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Regenerate…
            </Button>
          )}
          <Button variant="outline" onClick={() => setPresenting(true)}>
            <Play className="h-4 w-4" aria-hidden />
            Present
          </Button>
          <Button variant="accent" onClick={save} isLoading={saving} disabled={!dirty}>
            {dirty ? 'Save' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[180px_1fr]">
        <div className="order-2 lg:order-1">
          <SlideList
            deck={bound}
            selected={selected}
            onSelect={setSelected}
            onMove={by => change(moveSlide(deck, selected, by))}
            onDuplicate={() => change(duplicateSlide(deck, selected))}
            onRemove={() => change(removeSlide(deck, selected))}
          />
          <div className="mt-4 space-y-2">
            <select
              aria-label="Layout of the new slide"
              className="min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-2 text-sm text-fg-primary"
              value={newLayout}
              onChange={e => setNewLayout(e.target.value as Layout)}
            >
              {LAYOUTS.map(l => (
                <option key={l} value={l}>
                  {LAYOUT_LABELS[l]}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => change(insertSlide(deck, selected, blankSlide(newLayout)))}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add slide
            </Button>
          </div>
        </div>

        <div className="order-1 space-y-6 lg:order-2">
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <Slide slide={preview} theme={deck.theme} />
          </div>
          <SlideForm
            key={slide.id}
            slide={slide}
            onChange={patch => change(updateSlide(deck, selected, patch))}
          />
        </div>
      </div>

      {presenting && (
        <DeckPresenter
          deck={bound}
          allowNotes
          extraControls={
            <button type="button" onClick={() => setPresenting(false)} aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </button>
          }
        />
      )}
    </div>
  );
}
