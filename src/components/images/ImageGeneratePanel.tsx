'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Key, Loader2, Sparkles } from 'lucide-react';
import { fetchImageGenCapability, generateImage } from '@/services/images/generate-client';
import type { StockImage } from '@/services/images/types';
import { ROUTES } from '@/config/routes';
import { getAIProvider } from '@/data/aiProviders';
import { IMAGE_PROVIDER_RUNTIME } from '@/config/ai-provider-runtime';
import { IMAGE_PROMPT_LIMITS } from '@/config/images';

// Derived from the runtime SSOT — adding an image provider updates this copy.
const IMAGE_PROVIDER_NAMES = Object.keys(IMAGE_PROVIDER_RUNTIME)
  .map(id => getAIProvider(id)?.name ?? id)
  .join(', ');

/** Provider errors that mean "your balance ran out", not "bad prompt". */
const BALANCE_ERROR = /credit|billing|insufficient|quota|payment|top.?up|exceed|limit reached/i;

/**
 * BYOK image generation panel for the shared image picker. Probes capability
 * on open; without an image-capable key it shows a Settings → AI pointer
 * instead of a dead form. Generation runs on the user's own key only.
 */
export default function ImageGeneratePanel({
  initialPrompt = '',
  onPick,
}: {
  initialPrompt?: string;
  onPick: (image: StockImage) => void;
}) {
  const [capability, setCapability] = useState<{
    canGenerate: boolean;
    provider: string | null;
  } | null>(null);
  const [prompt, setPrompt] = useState(initialPrompt.slice(0, IMAGE_PROMPT_LIMITS.max));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; prompt: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchImageGenCapability().then(cap => {
      if (!cancelled) {
        setCapability(cap);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (trimmed.length < IMAGE_PROMPT_LIMITS.min || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const generated = await generateImage(trimmed);
      setResult({ url: generated.url, prompt: trimmed });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate an image. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (capability === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-tertiary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your AI keys…
      </div>
    );
  }

  if (!capability.canGenerate) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Sparkles className="h-6 w-6 text-fg-tertiary" />
        <p className="max-w-xs text-sm text-fg-secondary">
          Image generation runs on your own AI key — the free OrangeCat pool is text-only.
        </p>
        <Link
          href={ROUTES.SETTINGS_AI}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-warm px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-warm/90"
        >
          <Key className="h-3.5 w-3.5" />
          Add a key ({IMAGE_PROVIDER_NAMES})
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        rows={3}
        maxLength={IMAGE_PROMPT_LIMITS.max}
        placeholder="Describe the image you want…"
        aria-label="Image prompt"
        disabled={busy}
        className="w-full rounded-md border border-default bg-surface-page px-3 py-2 text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-fg-primary focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={prompt.trim().length < IMAGE_PROMPT_LIMITS.min || busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-warm px-3 py-1.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-warm/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? 'Generating… ~30s' : result ? 'Generate again' : 'Generate'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-status-negative">
          {error}
          {BALANCE_ERROR.test(error) &&
            (() => {
              const provider = getAIProvider(capability.provider ?? '');
              const topUpUrl = provider?.billingUrl ?? provider?.apiKeyUrl;
              return topUpUrl ? (
                <>
                  {' '}
                  <a
                    href={topUpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-fg-primary underline underline-offset-4 hover:text-fg-secondary"
                  >
                    Top up your {provider?.name} balance →
                  </a>
                </>
              ) : null;
            })()}
        </p>
      )}

      {result && !busy && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic dimensions unknown at render time and the layout sizes to the image (w-auto/max-h); next/image needs fixed dims or a sized fill container */}
          <img
            src={result.url}
            alt={result.prompt}
            className="max-h-64 w-auto max-w-full rounded-md border border-subtle object-contain"
          />
          <button
            type="button"
            onClick={() =>
              onPick({
                id: `gen-${Date.now()}`,
                thumbUrl: result.url,
                fullUrl: result.url,
                title: result.prompt,
                creator: null,
                license: 'ai-generated',
                sourceUrl: null,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-default px-3 py-1.5 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
          >
            Use this image
          </button>
        </div>
      )}

      <p className="text-2xs text-fg-tertiary">
        Generated with your own{' '}
        {getAIProvider(capability.provider ?? '')?.name ?? capability.provider} key and labeled
        AI-generated.
      </p>
    </div>
  );
}
