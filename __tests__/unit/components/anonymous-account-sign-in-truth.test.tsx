// @vitest-environment jsdom
/**
 * A "Start instantly" account is told the truth about getting back in.
 *
 * Production (2026-11-12), signed in as an anonymous account (no email, no
 * identities): Settings → Ways to sign in drew an empty bordered list and said
 * "Only one way in. If you lose it, only support can get you back" — there
 * were none, and support had nothing to find it by. Email Address described
 * "the email address associated with your account" over an empty field. And
 * "Sign out all devices" signed out globally on one tap, which ends such an
 * account for good. Now the zero case says so, offers the step that adds a way
 * in, and the sign-out asks first.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { toast } from 'sonner';
import { SignInMethodsCard } from '@/components/auth/SignInMethodsCard';
import { SettingsSecuritySection } from '@/app/(authenticated)/settings/SettingsSecuritySection';
import { SettingsEmailSection } from '@/app/(authenticated)/settings/SettingsEmailSection';
import { NO_WAY_IN, type SignInMethod } from '@/lib/auth/sign-in-methods';
import { API_ROUTES } from '@/config/api-routes';
import { useSettingsForm } from '@/app/(authenticated)/settings/useSettingsForm';

const auth = vi.hoisted(() => ({
  listSignInMethods: vi.fn(),
  listPasskeys: vi.fn(),
  linkProvider: vi.fn(),
  unlinkMethod: vi.fn(),
}));
const signOut = vi.hoisted(() => vi.fn());
const updateUser = vi.hoisted(() => vi.fn());

vi.mock('@/services/supabase/auth', () => auth);
vi.mock('@/lib/supabase/browser', () => ({
  supabase: { auth: { signOut, updateUser } },
  default: { auth: { signOut, updateUser } },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/auth/MFASetup', () => ({ MFAStatus: () => null }));
vi.mock('@/components/auth/PasskeysCard', () => ({ PasskeysCard: () => null }));
vi.mock('@/components/nostr/NostrConnectionCard', () => ({ NostrConnectionCard: () => null }));

const EMAIL: SignInMethod = {
  id: 'identity-email',
  provider: 'email',
  oauthProvider: null,
  handle: 'person@example.com',
  createdAt: null,
  lastSignInAt: null,
};

let fetcher: ReturnType<typeof vi.fn>;

function ok(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200 });
}

beforeEach(() => {
  auth.listPasskeys.mockResolvedValue({ passkeys: [], error: null });
  signOut.mockResolvedValue({ error: null });
  fetcher = vi.fn(async (url: string) => {
    if (url === API_ROUTES.AUTH.OAUTH_PROVIDERS) {
      return ok({ providers: ['google', 'github'] });
    }
    if (url === API_ROUTES.AUTH.PASSKEYS_AVAILABLE) {
      return ok({ available: false });
    }
    return ok({});
  });
  vi.stubGlobal('fetch', fetcher);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Ways to sign in, with no way in', () => {
  it('draws no empty list, says there is no way back in, and leads to adding an email', async () => {
    auth.listSignInMethods.mockResolvedValue({ methods: [], error: null });
    const onAddEmail = vi.fn();
    const onWaysInChange = vi.fn();
    render(<SignInMethodsCard onAddEmail={onAddEmail} onWaysInChange={onWaysInChange} />);

    expect(await screen.findByText(NO_WAY_IN.warning)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText(/only support can get you back/)).toBeNull();
    // Reported from an effect, which can land just after the text does.
    await waitFor(() => expect(onWaysInChange).toHaveBeenLastCalledWith(0));

    fireEvent.click(screen.getByRole('button', { name: NO_WAY_IN.addEmail }));
    expect(onAddEmail).toHaveBeenCalledTimes(1);
    // Linking a provider is still on offer: it is a way in too.
    expect(screen.getByRole('button', { name: /Link Google/ })).toBeTruthy();
  });

  it('keeps the one-way-in warning for an account that has exactly one', async () => {
    auth.listSignInMethods.mockResolvedValue({ methods: [EMAIL], error: null });
    render(<SignInMethodsCard />);

    expect(await screen.findByText(/Only one way in/)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText(NO_WAY_IN.warning)).toBeNull();
  });

  it('claims neither when the list could not be read', async () => {
    auth.listSignInMethods.mockResolvedValue({ methods: [], error: { message: 'down' } });
    const onWaysInChange = vi.fn();
    render(<SignInMethodsCard onWaysInChange={onWaysInChange} />);

    expect(await screen.findByText(/Could not load your sign-in methods/)).toBeTruthy();
    expect(screen.queryByText(NO_WAY_IN.warning)).toBeNull();
    expect(screen.queryByText(/Only one way in/)).toBeNull();
    // Reported from an effect, which can land just after the text does.
    await waitFor(() => expect(onWaysInChange).toHaveBeenLastCalledWith(null));
  });
});

describe('Sign out all devices', () => {
  const section = (props: Partial<Parameters<typeof SettingsSecuritySection>[0]> = {}) => (
    <SettingsSecuritySection
      mfaStatusKey={0}
      onEnableMFA={() => {}}
      onMFADisableComplete={() => {}}
      {...props}
    />
  );
  const signOutCalls = () =>
    fetcher.mock.calls.filter(([url]) => url === API_ROUTES.AUTH.SIGNOUT_EVERYWHERE);

  it('asks first, with the warning, when the account has no way back in', async () => {
    auth.listSignInMethods.mockResolvedValue({ methods: [], error: null });
    const onAddEmail = vi.fn();
    render(section({ accountIsAnonymous: true, onAddEmail }));

    expect(await screen.findByText(NO_WAY_IN.signOutNote)).toBeTruthy();
    expect(screen.queryByText(/You'll need to sign in again/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out all devices' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(NO_WAY_IN.confirmTitle);
    expect(dialog.textContent).toContain(NO_WAY_IN.confirmBody);
    expect(signOutCalls()).toHaveLength(0);
    expect(signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(signOut).not.toHaveBeenCalled();

    // The step that keeps the account sits beside the button.
    fireEvent.click(screen.getAllByRole('button', { name: NO_WAY_IN.addEmail })[0]);
    expect(onAddEmail).toHaveBeenCalled();
  });

  it('signs out only once the person confirms', async () => {
    auth.listSignInMethods.mockResolvedValue({ methods: [], error: null });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(section({ accountIsAnonymous: true }));

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out all devices' }));
    fireEvent.click(await screen.findByRole('button', { name: NO_WAY_IN.confirmLabel }));

    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: 'global' }));
    expect(signOutCalls()).toHaveLength(1);
  });

  it('signs an account with a way in out at once, as before', async () => {
    auth.listSignInMethods.mockResolvedValue({ methods: [EMAIL], error: null });
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
    render(section());

    await screen.findByText(/Only one way in/);
    expect(screen.queryByText(NO_WAY_IN.signOutNote)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out all devices' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: 'global' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Email Address', () => {
  it('asks a "Start instantly" account to add one instead of describing one it lacks', () => {
    render(
      <SettingsEmailSection
        email=""
        hasEmail={false}
        isSubmitting={false}
        onChange={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(screen.getByText(/Add an email to keep this account/)).toBeTruthy();
    expect(screen.queryByText(/associated with your account/)).toBeNull();
    expect(screen.getByRole('button', { name: NO_WAY_IN.addEmail })).toBeTruthy();
  });

  it('still describes the address an account has', () => {
    render(
      <SettingsEmailSection
        email="person@example.com"
        isSubmitting={false}
        onChange={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(screen.getByText(/associated with your account/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update Email' })).toBeTruthy();
  });
});

describe('Adding the email', () => {
  const submit = async () => {
    const { result } = renderHook(() => useSettingsForm(null));
    act(() => {
      result.current.handleInputChange({
        target: { name: 'email', value: 'person@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    await act(() => result.current.handleEmailUpdate({ preventDefault() {} } as React.FormEvent));
  };

  it('promises no confirmation email when the address was set at once', async () => {
    updateUser.mockResolvedValue({
      data: { user: { email: 'person@example.com', new_email: undefined } },
      error: null,
    });
    await submit();
    expect(toast.success).toHaveBeenCalledWith('Email saved. It is now a way to sign in.');
  });

  it('says to check the inbox when the address waits on the link', async () => {
    updateUser.mockResolvedValue({
      data: { user: { email: '', new_email: 'person@example.com' } },
      error: null,
    });
    await submit();
    expect(toast.success).toHaveBeenCalledWith('Confirmation email sent! Please check your inbox.');
  });
});
