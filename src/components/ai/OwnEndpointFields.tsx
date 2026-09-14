'use client';

import { Input } from '@/components/ui/Input';

interface OwnEndpointFieldsProps {
  baseUrl: string;
  defaultModel: string;
  onBaseUrlChange: (value: string) => void;
  onDefaultModelChange: (value: string) => void;
  onFieldFocus?: (field: string | null) => void;
}

/**
 * The two facts only the person running a server can supply: where it is,
 * and what it serves. Everything else about "Your own endpoint" is the same
 * as any vendor key — same table, same chain, same tool loop.
 */
export function OwnEndpointFields({
  baseUrl,
  defaultModel,
  onBaseUrlChange,
  onDefaultModelChange,
  onFieldFocus,
}: OwnEndpointFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">Base URL</label>
        <Input
          type="url"
          inputMode="url"
          value={baseUrl}
          onChange={e => onBaseUrlChange(e.target.value)}
          onFocus={() => onFieldFocus?.('baseUrl')}
          onBlur={() => onFieldFocus?.(null)}
          placeholder="https://models.example.org/v1"
        />
        <p className="mt-1 text-xs text-fg-secondary">
          The OpenAI-compatible base, usually ending in <code>/v1</code>. Cat calls it from
          OrangeCat&apos;s server, so it must be reachable from the internet — a box on your own
          network is used from the browser instead, under &ldquo;Run locally&rdquo;.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">Model (optional)</label>
        <Input
          value={defaultModel}
          onChange={e => onDefaultModelChange(e.target.value)}
          onFocus={() => onFieldFocus?.('defaultModel')}
          onBlur={() => onFieldFocus?.(null)}
          placeholder="the id your server reports under /models"
        />
        <p className="mt-1 text-xs text-fg-secondary">
          Left empty, Cat uses the first model your server lists. You can still pick any model id
          per chat.
        </p>
      </div>
    </>
  );
}
