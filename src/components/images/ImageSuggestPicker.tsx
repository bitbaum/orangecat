'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, X, ImageOff, Sparkles, Upload, KeyRound } from 'lucide-react';
import { suggestImages } from '@/services/images/suggest-client';
import ImageGeneratePanel from '@/components/images/ImageGeneratePanel';
import ImageUploadPanel from '@/components/images/ImageUploadPanel';
import { fetchImageGenCapability } from '@/services/images/generate-client';
import { IMAGE_SEARCH_QUERY_MAX } from '@/config/images';
import type { StockImage } from '@/services/images/types';
import { cn } from '@/lib/utils';

type PickerMode = 'search' | 'generate' | 'upload';

/** Last-used tab persists so habitual uploaders skip a click every time. */
const MODE_STORAGE_KEY = 'oc-image-picker-mode';

function loadSavedMode(): PickerMode {
  if (typeof window === 'undefined') {
    return 'search';
  }
  const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
  return saved === 'generate' || saved === 'upload' ? saved : 'search';
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-default bg-surface-raised font-medium text-fg-primary'
          : 'border-subtle text-fg-secondary hover:border-default hover:text-fg-primary'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Image picker with three modes: Search (Openverse CC0/public-domain, AI
 * turns the given text into search terms), Generate (the user's OWN
 * OpenRouter/OpenAI/xAI key — see ImageGeneratePanel), and Upload (own
 * photo). Picking any way hands back a full-res URL. Used for article
 * covers, inline article images, and the timeline post composer.
 */
export default function ImageSuggestPicker({
  title,
  body,
  heading = 'Add an image',
  onPick,
  onClose,
}: {
  title: string;
  body: string;
  heading?: string;
  onPick: (image: StockImage) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PickerMode>(loadSavedMode);
  const [searchStarted, setSearchStarted] = useState(false);
  const [canGenerate, setCanGenerate] = useState<boolean | null>(null);
  const [images, setImages] = useState<StockImage[]>([]);
  const [queries, setQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  const load = useCallback(
    async (query?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await suggestImages(query ? { query } : { title, body });
        setImages(result.images);
        setQueries(result.queries);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load images. Try again.');
      } finally {
        setLoading(false);
      }
    },
    [title, body]
  );
  const searchManual = () => {
    if (manual.trim()) {
      void load(manual.trim());
    }
  };

  // Search is lazy: the (LLM + Openverse) call only fires when the Search tab
  // is actually shown — opening straight into Upload/Generate costs nothing.
  useEffect(() => {
    if (mode === 'search' && !searchStarted) {
      setSearchStarted(true);
      void load();
    }
  }, [mode, searchStarted, load]);

  // Cached capability probe (generate-client) so the Generate tab can show a
  // key hint up front instead of a dead-end panel.
  useEffect(() => {
    let cancelled = false;
    void fetchImageGenCapability().then(cap => {
      if (!cancelled) {
        setCanGenerate(cap.canGenerate);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function switchMode(next: PickerMode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Private-mode storage failures just lose the convenience.
    }
  }

  return (
    <div className="rounded-lg border border-default bg-surface-raised/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-fg-primary">{heading}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-fg-tertiary transition-colors hover:text-fg-primary"
          aria-label="Close image picker"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Image source">
        <ModeTab active={mode === 'search'} onClick={() => switchMode('search')}>
          <Search className="h-3.5 w-3.5" />
          Search free photos
        </ModeTab>
        <ModeTab active={mode === 'generate'} onClick={() => switchMode('generate')}>
          {canGenerate === false ? (
            <KeyRound className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate
        </ModeTab>
        <ModeTab active={mode === 'upload'} onClick={() => switchMode('upload')}>
          <Upload className="h-3.5 w-3.5" />
          Upload
        </ModeTab>
      </div>

      {mode === 'upload' ? (
        <ImageUploadPanel onPick={onPick} />
      ) : mode === 'generate' ? (
        <ImageGeneratePanel initialPrompt={title || body} onPick={onPick} />
      ) : (
        <>
          {/* Not a <form>: the picker also sits inside entity forms, where a
              nested form is invalid and Enter would submit the outer one. */}
          <div role="search" className="mb-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" />
              <input
                type="text"
                value={manual}
                maxLength={IMAGE_SEARCH_QUERY_MAX}
                onChange={e => setManual(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchManual();
                  }
                }}
                placeholder="Search free images…"
                aria-label="Search images"
                className="w-full rounded-md border border-default bg-surface-page py-1.5 pl-8 pr-3 text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-accent-warm focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={searchManual}
              disabled={!manual.trim() || loading}
              className="rounded-md border border-default px-3 py-1.5 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised disabled:opacity-50"
            >
              Search
            </button>
          </div>

          {queries.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {queries.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setManual(q);
                    void load(q);
                  }}
                  className="rounded-full border border-subtle px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:border-default hover:text-fg-primary"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Finding images…
            </div>
          ) : error ? (
            <p className="py-6 text-center text-xs text-status-negative">{error}</p>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center text-fg-tertiary">
              <ImageOff className="h-6 w-6" />
              <p className="text-xs">No images found. Try a different search term.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map(img => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => onPick(img)}
                    className={cn(
                      'group block w-full overflow-hidden rounded-md border border-subtle transition-colors hover:border-accent-warm'
                    )}
                    title={img.creator ? `${img.title} · ${img.creator}` : img.title}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Openverse thumbnails live on arbitrary external hosts; next/image would throw for hosts outside images.remotePatterns */}
                    <img
                      src={img.thumbUrl}
                      alt={img.title}
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-surface-page object-cover"
                    />
                    <span className="block truncate px-1.5 py-1 text-left text-2xs text-fg-tertiary">
                      {img.creator
                        ? `${img.creator} · ${img.license.toUpperCase()}`
                        : img.license.toUpperCase()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-2 text-2xs text-fg-tertiary">
            Free to use (CC0 / public domain) via Openverse.
          </p>
        </>
      )}
    </div>
  );
}
