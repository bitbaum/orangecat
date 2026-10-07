// @vitest-environment jsdom
/**
 * Form state must keep what the person chose (audit, 2026-10-07):
 * - several changes in one tick (picking a wallet sets three fields) each
 *   started from the same stale snapshot, so only the last one survived;
 * - the reset after mount dropped the user's currency, so the field showed
 *   EUR while the server stored CHF.
 */
import { renderHook, act } from '@testing-library/react';
import { useEntityFormState } from '@/components/create/EntityForm/hooks/useEntityFormState';
import type { EntityConfig } from '@/components/create/types';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

type Data = Record<string, unknown>;
const config = {
  type: 'service',
  defaultValues: {
    title: '',
    currency: undefined,
    _wallet_id: null,
    bitcoin_address: '',
    lightning_address: '',
  },
  fieldGroups: [],
} as unknown as EntityConfig<Data>;

describe('useEntityFormState', () => {
  beforeEach(() => localStorage.clear());

  it('keeps every field changed in the same tick', () => {
    const { result } = renderHook(() =>
      useEntityFormState({ config, userCurrency: 'EUR', userId: 'u', mode: 'create' })
    );
    act(() => {
      result.current.handleFieldChange('bitcoin_address', '');
      result.current.handleFieldChange('lightning_address', 'me@coinos.io');
      result.current.handleFieldChange('_wallet_id', 'w1');
    });
    expect(result.current.formState.data).toMatchObject({
      lightning_address: 'me@coinos.io',
      _wallet_id: 'w1',
    });
  });

  it("keeps the user's currency after the mount-time reset", () => {
    const { result } = renderHook(() =>
      useEntityFormState({ config, userCurrency: 'EUR', userId: 'u', mode: 'create' })
    );
    expect(result.current.formState.data.currency).toBe('EUR');
  });

  it('an AI answer never undoes an edit made while it was thinking', () => {
    const { result } = renderHook(() =>
      useEntityFormState({ config, userCurrency: 'EUR', userId: 'u', mode: 'create' })
    );
    act(() => result.current.handleFieldChange('title', 'Bike repair'));
    const sent = { title: 'Bike repair' };
    // The person keeps typing while the request is in flight.
    act(() => result.current.handleFieldChange('title', 'Bike repair in Basel'));
    act(() =>
      result.current.handleAIPrefill(
        { title: 'Bike repair', lightning_address: 'me@coinos.io' },
        {},
        ['title', 'lightning_address'],
        sent
      )
    );
    expect(result.current.formState.data.title).toBe('Bike repair in Basel');
    expect(result.current.formState.data.lightning_address).toBe('me@coinos.io');
    expect(result.current.aiGeneratedFields.fields.has('title')).toBe(false);
  });

  it('picking a template keeps what was already typed', () => {
    let initialValues: Data | undefined;
    const { result, rerender } = renderHook(() =>
      useEntityFormState({
        config,
        initialValues,
        userCurrency: 'EUR',
        userId: 'u',
        mode: 'create',
      })
    );
    act(() => result.current.handleFieldChange('title', 'My own title'));
    initialValues = { title: 'Template title', lightning_address: 'tpl@example.com' };
    rerender();
    expect(result.current.formState.data.title).toBe('My own title');
    expect(result.current.formState.data.lightning_address).toBe('tpl@example.com');
  });
});
