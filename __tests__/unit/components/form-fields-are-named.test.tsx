// @vitest-environment jsdom
/**
 * A field is announced by its visible label, not its placeholder. Each of
 * these labels sat beside its control without pointing at it, so a screen
 * reader read "you@wallet.com or bc1…" for "Your wallet" (/receive and every
 * create form's Pay-into), and nothing at all for the reset-password fields.
 *
 * The orange help links on /receive were orange text, 2.1:1 on the light
 * surface; the words are now the text colour and the orange is the underline.
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { WalletForm } from '@/components/wallets/WalletManager/components/WalletForm';
import { WhyReceive } from '@/components/wallets/WhyReceive';
import { ProfileBasicSection } from '@/components/profile/sections/ProfileBasicSection';
import type { ProfileFormValues } from '@/components/profile/types';
import { OtpForm } from '@/app/auth/reset-password/OtpForm';
import { NewPasswordForm } from '@/app/auth/reset-password/NewPasswordForm';
import IntelligentOnboarding from '@/components/onboarding/IntelligentOnboarding';

vi.mock('@/lib/supabase/browser', () => ({ default: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('@/hooks/useCatHealth', () => ({
  useCatHealth: () => ({ health: null, probe: vi.fn() }),
}));

afterEach(cleanup);

describe('the wallet form', () => {
  it('names the paste box and every advanced and optional field by its label', async () => {
    const user = userEvent.setup();
    render(<WalletForm onSubmit={async () => undefined} />);

    const wallet = screen.getByRole('textbox', { name: 'Your wallet' });
    expect(wallet.getAttribute('placeholder')).toBe('you@wallet.com or bc1…');

    await user.click(screen.getByRole('button', { name: /Other ways to get paid/ }));
    expect(screen.getByRole('textbox', { name: 'On-chain Bitcoin address or extended key' }));
    // A password input has no role; the label still has to reach it.
    expect(screen.getByLabelText('Wallet connection link').getAttribute('type')).toBe('password');

    await user.click(screen.getByRole('button', { name: /Name & details/ }));
    expect(screen.getByRole('textbox', { name: 'Wallet name' }));
    expect(screen.getByRole('textbox', { name: 'Description' }));
    expect(screen.getByRole('spinbutton', { name: 'Funding goal' }));
    expect(screen.getByRole('combobox', { name: 'Goal currency' }));
    expect(screen.getByRole('group', { name: 'Category' }));
  });
});

describe('the orange help links on /receive', () => {
  const orangeText = /(^|\s)(hover:)?text-accent-warm/;

  it('keep their words in the text colour, a 44px target, and the orange in the underline', () => {
    render(
      <>
        <WhyReceive />
        <WalletForm onSubmit={async () => undefined} />
      </>
    );
    for (const name of ['Why do I need this?', /have a wallet\? Get one free/]) {
      const link = screen.getByRole('button', { name });
      expect(link.className).not.toMatch(orangeText);
      expect(link.className).toMatch(/(^|\s)text-fg-primary(\s|$)/);
      expect(link.className).toMatch(/(^|\s)decoration-accent-warm/);
      expect(link.className).toMatch(/(^|\s)min-h-11(\s|$)/);
    }
  });
});

function ProfileHarness() {
  const form = useForm<ProfileFormValues>({ defaultValues: { username: '', name: '' } });
  return (
    <Form {...form}>
      <ProfileBasicSection
        control={form.control}
        form={form}
        locationMode="actual"
        setLocationMode={() => undefined}
        locationGroupLabel=""
        setLocationGroupLabel={() => undefined}
      />
    </Form>
  );
}

describe('the profile editor', () => {
  it('points Username and Location at their inputs, not at a wrapper', () => {
    render(<ProfileHarness />);

    const username = screen.getByRole('textbox', { name: /Username/ });
    expect(username.tagName).toBe('INPUT');
    expect(username.getAttribute('placeholder')).toBe('your_unique_username');

    const location = screen.getByRole('textbox', { name: 'Location' });
    expect(location.getAttribute('placeholder')).toBe('Type your city or address...');
  });
});

describe('the password reset', () => {
  it('names the email and code fields', () => {
    render(<OtpForm onVerified={() => undefined} onRequestNewReset={() => undefined} />);

    expect(screen.getByRole('textbox', { name: /Email address/ }).getAttribute('type')).toBe(
      'email'
    );
    expect(screen.getByRole('textbox', { name: /6-digit code/ }).getAttribute('autocomplete')).toBe(
      'one-time-code'
    );
  });

  it('names both new-password fields, asks for a new password, and keeps each eye in its box', () => {
    render(<NewPasswordForm onSuccess={() => undefined} />);

    for (const name of ['New password', 'Confirm new password']) {
      const field = screen.getByLabelText(name) as HTMLInputElement;
      expect(field.type).toBe('password');
      expect(field.getAttribute('autocomplete')).toBe('new-password');
      // The eye shares the field's box (positioned inside it), and says which field it reveals.
      const eye = field.parentElement!.querySelector('button')!;
      expect(eye.getAttribute('aria-label')).toBe('Show password');
      expect(eye.getAttribute('aria-controls')).toBe(field.id);
    }
  });
});

describe('onboarding', () => {
  it('names the main textarea by its question', () => {
    render(<IntelligentOnboarding />);

    const description = screen.getByRole('textbox', { name: 'Who are you? What do you do?' });
    expect(description.tagName).toBe('TEXTAREA');
  });
});
