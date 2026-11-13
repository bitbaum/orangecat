'use client';

/**
 * The row in a group chat's details that gives it a picture of its own: a
 * shape and a colour, as for a bot, or back to its members' faces. Opens
 * inline under the row, like every other setting in the sheet.
 */

import { useState } from 'react';
import { avatarPath, faceForName, parseFaceUrl } from '@/config/companion-avatars';
import { COMPANION_COPY } from '@/config/companions';
import Button from '@/components/ui/Button';
import { Face } from './CompanionFace';
import { FacePicker } from './FacePicker';
import { DetailRow } from './TalkDetailsSheet';

export function RoomFaceRow({
  title,
  avatarUrl,
  onSet,
}: {
  title: string;
  avatarUrl: string | null;
  /** Resolves true when the server took it. */
  onSet: (face: { shape: string; hue: string } | null) => Promise<boolean>;
}) {
  const copy = COMPANION_COPY.talk.room.face;
  const current = parseFaceUrl(avatarUrl);
  const suggested = faceForName(title);
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState(current?.shape ?? suggested.shape.id);
  const [hue, setHue] = useState(current?.hue ?? suggested.hue.id);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function apply(face: { shape: string; hue: string } | null) {
    setBusy(true);
    setFailed(false);
    const ok = await onSet(face).catch(() => false);
    setBusy(false);
    if (ok) {
      setOpen(false);
    } else {
      setFailed(true);
    }
  }

  return (
    <>
      <DetailRow onClick={() => setOpen(v => !v)}>{copy.row}</DetailRow>
      {open && (
        <div className="flex flex-col gap-4 px-4 pb-3">
          <div className="flex justify-center">
            <Face name={title} avatarUrl={avatarPath(shape, hue)} size={96} />
          </div>
          <FacePicker shapeId={shape} hueId={hue} onShape={setShape} onHue={setHue} />
          {failed && <p className="mb-0 text-sm text-status-negative">{copy.failed}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void apply({ shape, hue })}
            >
              {busy ? copy.saving : copy.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !avatarUrl}
              onClick={() => void apply(null)}
            >
              {copy.reset}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
