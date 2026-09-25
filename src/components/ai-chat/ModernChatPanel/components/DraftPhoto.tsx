/**
 * The chat photo a Cat draft was made from, on the draft card — shown from
 * private storage, with a switch to leave it off. `publishDraftPhoto` makes it
 * public only when the user acts on the draft (publish, save, open form), so a
 * draft nobody uses never publishes anyone's picture.
 */

import { API_ROUTES } from '@/config/api-routes';

export async function publishDraftPhoto(ref: string): Promise<string | null> {
  try {
    const res = await fetch(API_ROUTES.CAT.ATTACHMENTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ path: ref }),
    });
    const json = await res.json().catch(() => null);
    return res.ok && typeof json?.data?.url === 'string' ? json.data.url : null;
  } catch {
    return null;
  }
}

interface DraftPhotoProps {
  photoRef: string;
  use: boolean;
  onUseChange: (use: boolean) => void;
  disabled?: boolean;
}

export function DraftPhoto({ photoRef, use, onUseChange, disabled }: DraftPhotoProps) {
  return (
    <label className="mb-3 flex cursor-pointer items-center gap-3">
      {/* Private signed URL behind a redirect: nothing for next/image to do. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={API_ROUTES.CAT.ATTACHMENT(photoRef)}
        alt="Photo for this listing"
        className={`h-20 w-20 flex-shrink-0 rounded-lg border border-subtle object-cover ${use ? '' : 'opacity-40'}`}
      />
      <span className="flex items-center gap-2 text-sm text-fg-primary">
        <input
          type="checkbox"
          checked={use}
          disabled={disabled}
          onChange={e => onUseChange(e.target.checked)}
          className="h-4 w-4"
        />
        Use this photo on the listing
      </span>
    </label>
  );
}
