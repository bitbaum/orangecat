// @vitest-environment jsdom
/**
 * Draft autosave/restore must never act on the user's behalf.
 *
 * Observed in production 2026-08-25 on /dashboard/projects/create: starting a
 * NEW project silently restored the previous one ("Draft loaded from 1 minute
 * ago. Your previous work has been restored.") — every field had to be
 * overwritten by hand or the previous project would have been duplicated. Two
 * defects compounded:
 *
 * 1. A found draft was applied to the form unasked, instead of offered.
 * 2. The autosave interval kept ticking after a successful create (the success
 *    screen leaves the submitted values in form state), so the tick after
 *    clearDraft() re-saved the just-created entity as a "draft".
 *
 * These tests lock the corrected contract: restore is an OFFER (toast action),
 * clearDraft() ends autosaving for the mount, and a pristine form neither
 * writes junk drafts nor clobbers a stored one.
 */

import { renderHook, act } from '@testing-library/react';
import { useEntityFormDraft } from '@/components/create/EntityForm/hooks/useEntityFormDraft';
import type { EntityConfig } from '@/components/create/types';

const toastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: { info: (...a: unknown[]) => toastInfo(...a) },
}));

type Data = Record<string, unknown>;

const config = { type: 'project' } as unknown as EntityConfig<Data>;
const userId = 'user-1';
const draftKey = 'project-draft-user-1';

function options(formStateData: Data, setFormState = vi.fn()) {
  return { mode: 'create' as const, userId, config, formStateData, setFormState };
}

describe('useEntityFormDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers a stored draft instead of silently applying it', () => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({ formData: { title: 'Previous project' }, savedAt: new Date().toISOString() })
    );
    const setFormState = vi.fn();

    renderHook(() => useEntityFormDraft(options({ title: '', status: 'draft' }, setFormState)));

    // Nothing applied unasked.
    expect(setFormState).not.toHaveBeenCalled();
    // But the offer went out, with a Restore action.
    expect(toastInfo).toHaveBeenCalledTimes(1);
    const [, opts] = toastInfo.mock.calls[0] as [string, { action: { onClick: () => void } }];

    act(() => opts.action.onClick());
    expect(setFormState).toHaveBeenCalledTimes(1);
  });

  it('stops autosaving after clearDraft — a create must not resurrect as a draft', () => {
    const submitted = { title: 'Just created', status: 'active' };
    const { result, rerender } = renderHook(({ data }) => useEntityFormDraft(options(data)), {
      initialProps: { data: { title: '', status: 'draft' } as Data },
    });

    // User typed → autosave writes a draft.
    rerender({ data: submitted });
    act(() => vi.advanceTimersByTime(10_000));
    expect(localStorage.getItem(draftKey)).not.toBeNull();

    // Successful create clears it; the interval keeps ticking with the
    // submitted values still in form state.
    act(() => result.current.clearDraft());
    expect(localStorage.getItem(draftKey)).toBeNull();

    act(() => vi.advanceTimersByTime(30_000));
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it('never saves an untouched form — pristine defaults must not clobber a stored draft', () => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({ formData: { title: 'Real work' }, savedAt: new Date().toISOString() })
    );

    renderHook(() => useEntityFormDraft(options({ title: '', status: 'draft' })));
    act(() => vi.advanceTimersByTime(60_000));

    const stored = JSON.parse(localStorage.getItem(draftKey)!);
    expect(stored.formData.title).toBe('Real work');
  });
});
