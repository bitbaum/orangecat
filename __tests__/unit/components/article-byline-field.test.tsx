// @vitest-environment jsdom
/**
 * media#9: before the first publish, a writer with no name (only a minted
 * handle) is asked how their byline should read; the answer is saved as their
 * profile name. A writer with a name is not asked. Leaving it empty publishes.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import BylineField, { useBylinePrompt } from '@/app/(public)/articles/new/BylineField';

const store = vi.hoisted(() => ({
  profile: null as null | { name: string | null; username: string },
  updateProfile: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: (select: (s: typeof store) => unknown) => select(store),
}));

beforeEach(() => {
  store.updateProfile.mockReset();
  store.updateProfile.mockResolvedValue({ error: null });
});

describe('useBylinePrompt', () => {
  it('asks a writer whose only name is a minted handle', () => {
    store.profile = { name: 'user_e00864455095', username: 'user_e00864455095' };
    const { result } = renderHook(() => useBylinePrompt(true));
    expect(result.current.show).toBe(true);
  });

  it('does not ask a writer who has a name, or when editing', () => {
    store.profile = { name: 'Mao', username: 'user_e00864455095' };
    expect(renderHook(() => useBylinePrompt(true)).result.current.show).toBe(false);

    store.profile = { name: null, username: 'user_e00864455095' };
    expect(renderHook(() => useBylinePrompt(false)).result.current.show).toBe(false);
  });

  it('saves the typed name to the profile, with the handle the route requires', async () => {
    store.profile = { name: null, username: 'user_e00864455095' };
    const { result } = renderHook(() => useBylinePrompt(true));
    act(() => result.current.setValue('  Mao Zhang '));

    await expect(result.current.save()).resolves.toBeNull();
    expect(store.updateProfile).toHaveBeenCalledWith({
      username: 'user_e00864455095',
      name: 'Mao Zhang',
    });
  });

  it('leaving it empty is a choice: nothing is saved and publishing goes on', async () => {
    store.profile = { name: null, username: 'user_e00864455095' };
    const { result } = renderHook(() => useBylinePrompt(true));
    await expect(result.current.save()).resolves.toBeNull();
    expect(store.updateProfile).not.toHaveBeenCalled();
  });

  it('reports a failed save so publishing can stop and say why', async () => {
    store.profile = { name: null, username: 'user_e00864455095' };
    store.updateProfile.mockResolvedValue({ error: 'Too many requests' });
    const { result } = renderHook(() => useBylinePrompt(true));
    act(() => result.current.setValue('Mao'));
    await expect(result.current.save()).resolves.toMatch(/byline could not be saved/i);
  });
});

describe('BylineField', () => {
  it('renders a labelled field that names the fallback', () => {
    const setValue = vi.fn();
    render(
      <BylineField
        prompt={{ show: true, value: '', setValue, save: async () => null }}
        disabled={false}
      />
    );
    const input = screen.getByLabelText(/how should your byline read/i);
    fireEvent.change(input, { target: { value: 'Mao' } });
    expect(setValue).toHaveBeenCalledWith('Mao');
    expect(screen.getByText(/An OrangeCat member/)).toBeInTheDocument();
  });

  it('renders nothing when there is nothing to ask', () => {
    const { container } = render(
      <BylineField
        prompt={{ show: false, value: '', setValue: vi.fn(), save: async () => null }}
        disabled={false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
