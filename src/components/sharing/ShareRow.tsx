'use client';

import { ShareRow as BipShareRow, type ShareRowProps } from '@bitbaum/bip-kit/react';
import '@bitbaum/bip-kit/styles.css';
import '@/lib/longform/longform.css';

/**
 * The one way anything on OrangeCat is spread — a wall post, an article, a
 * profile, a project, any entity: `ShareRow` from `@bitbaum/bip-kit/react`
 * (the cross-post first, the device sheet, "Copy link", every service, one
 * line that scrolls sideways). The behaviour and layout are the package's;
 * this file only loads its stylesheet and OrangeCat's token mapping
 * (`longform.css`), which draws the row monochrome in OrangeCat's ink.
 *
 * Content that is not public passes `audience="restricted"`: outside services
 * would show a dead link, so the row keeps the cross-post and "Copy link" and
 * says who can open it.
 */
export function ShareRow({ className, ...row }: ShareRowProps & { className?: string }) {
  return (
    <div className={className ? `oc-share ${className}` : 'oc-share'}>
      <BipShareRow {...row} />
    </div>
  );
}

export type { CrossPost, ShareRowProps } from '@bitbaum/bip-kit/react';
