'use client';

/**
 * Make a companion in a minute: a name, a shape, a colour. Its job is not a
 * field here — it is the first thing the companion asks, and what the person
 * answers is remembered. The full form (definition, price, visibility) stays
 * on the edit page for whoever wants it.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@bitbaum/chatkit/react';
import { API_ROUTES } from '@/config/api-routes';
import { AVATAR_HUES, AVATAR_SHAPES, faceForName } from '@/config/companion-avatars';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { logger } from '@/utils/logger';

export function NewCompanionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const copy = COMPANION_COPY.talk.create;
  const [name, setName] = useState('');
  const [shape, setShape] = useState<string | null>(null);
  const [hue, setHue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggested = faceForName(name || '?');
  const shapeId = shape ?? suggested.shape.id;
  const hueId = hue ?? suggested.hue.id;
  const fill = AVATAR_HUES.find(h => h.id === hueId)?.fill ?? AVATAR_HUES[0].fill;
  const path = AVATAR_SHAPES.find(s => s.id === shapeId)?.d ?? AVATAR_SHAPES[0].d;

  async function create() {
    const title = name.trim();
    if (!title || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.TALK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, shape: shapeId, hue: hueId }),
      });
      const json = (await res.json()) as { data?: { id: string }; error?: { message?: string } };
      if (!res.ok || !json.data?.id) {
        throw new Error(json.error?.message || copy.failed);
      }
      onClose();
      setName('');
      router.push(ROUTES.AI_ASSISTANTS.TALK_WITH(json.data.id));
    } catch (err) {
      logger.error('companion quick create failed', err, 'NewCompanionSheet');
      setError(err instanceof Error ? err.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={copy.title} closeLabel={COMPANION_COPY.talk.close}>
      <form
        className="flex flex-col gap-5 p-4"
        onSubmit={e => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="flex justify-center">
          <svg viewBox="0 0 100 100" width={128} height={128} aria-hidden="true">
            <path d={path} fill={fill} />
            <g fill="#FFFFFF" fillOpacity="0.96">
              <rect x="38" y="38" width="8" height="18" rx="4" transform="rotate(-10 42 47)" />
              <rect x="56" y="38" width="8" height="18" rx="4" transform="rotate(-10 60 47)" />
            </g>
          </svg>
        </div>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={copy.name}
          aria-label={copy.name}
          maxLength={100}
          autoFocus
        />
        <fieldset>
          <legend className="mb-2 text-sm text-fg-secondary">{copy.shape}</legend>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_SHAPES.map(s => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === shapeId}
                aria-label={s.id}
                onClick={() => setShape(s.id)}
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  s.id === shapeId ? 'ring-2 ring-fg-primary' : ''
                }`}
              >
                <svg viewBox="0 0 100 100" width={32} height={32} aria-hidden="true">
                  <path d={s.d} fill={fill} />
                </svg>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm text-fg-secondary">{copy.colour}</legend>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_HUES.map(h => (
              <button
                key={h.id}
                type="button"
                role="radio"
                aria-checked={h.id === hueId}
                aria-label={h.id}
                onClick={() => setHue(h.id)}
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  h.id === hueId ? 'ring-2 ring-fg-primary' : ''
                }`}
              >
                <span className="block h-7 w-7 rounded-full" style={{ backgroundColor: h.fill }} />
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p className="mb-0 text-sm text-status-negative">{error}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={!name.trim() || busy}>
          {busy ? copy.creating : copy.submit}
        </Button>
      </form>
    </Sheet>
  );
}
