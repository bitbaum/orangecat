'use client';

/**
 * A face is a shape and a colour. The two rows that pick them, the same for
 * a new bot and for a group chat's own picture.
 */

import { AVATAR_HUES, AVATAR_SHAPES } from '@/config/companion-avatars';
import { COMPANION_COPY } from '@/config/companions';

export function FacePicker({
  shapeId,
  hueId,
  onShape,
  onHue,
}: {
  shapeId: string;
  hueId: string;
  onShape: (id: string) => void;
  onHue: (id: string) => void;
}) {
  const copy = COMPANION_COPY.talk.create;
  const fill = AVATAR_HUES.find(h => h.id === hueId)?.fill ?? AVATAR_HUES[0].fill;
  return (
    <>
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
              onClick={() => onShape(s.id)}
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
              onClick={() => onHue(h.id)}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${
                h.id === hueId ? 'ring-2 ring-fg-primary' : ''
              }`}
            >
              <span className="block h-7 w-7 rounded-full" style={{ backgroundColor: h.fill }} />
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
