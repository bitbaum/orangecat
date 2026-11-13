// @vitest-environment jsdom
/**
 * Small controls measured on production at 390px with a touch pointer
 * (2026-11-12): the dashboard's My Projects / Favorites tabs were 28px tall,
 * a create form's Cancel 24px, the "This is for" owner picker 30px, the
 * wallet form's two disclosures 16px (and neither said whether it was open),
 * "+ Add Link" 16px, the small mic 32px, onboarding's "Or just chat with your
 * Cat instead" 28px and "Can't get to your email?" 17px on the forgot and
 * reset pages. Each now reaches 44px on a touch screen.
 *
 * The owner picker also drew an empty ring for anyone without a photo: an
 * <img> with no src, which pushed the fallback icon out of the circle.
 *
 * "+ Add Link" sat inside the profile <form> as a bare <button>, so tapping it
 * submitted the whole profile (save, then off to /dashboard/info) instead of
 * opening the link form.
 */
import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/hooks/useDictation', () => ({
  useDictation: () => ({
    supported: true,
    isRecording: false,
    isTranscribing: false,
    toggle: vi.fn(),
  }),
}));

vi.mock('@/features/messaging/hooks/useMessagingActors', () => ({
  useMessagingActors: () => ({
    personalActor: { actor_id: 'actor-1', actor_type: 'user', name: 'You', avatar_url: null },
    groupActors: [],
    isLoading: false,
  }),
}));

vi.mock('@/lib/supabase/browser', () => ({ default: { auth: {} } }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: null }),
}));

vi.mock('@/hooks/useCatHealth', () => ({
  useCatHealth: () => ({ health: null, probe: vi.fn() }),
}));

vi.mock('@/services/profile', () => ({ ProfileService: {} }));

vi.mock('@/config/features', async importOriginal => {
  const actual = await importOriginal<typeof import('@/config/features')>();
  return { ...actual, FEATURES: { ...actual.FEATURES, voiceInput: true } };
});

vi.mock('@/components/create/EntityForm', () => ({ EntityForm: () => null }));

vi.mock('@/components/create/useEntityCreationWizard', () => ({
  useEntityCreationWizard: () => ({
    wizardSteps: [{ id: 'basics', title: 'Basics', description: '', fields: [] }],
    isTemplateOnlyMode: false,
    currentStep: 0,
    completedSteps: new Set<number>(),
    selectedTemplate: null,
    formInitialValues: {},
    showTemplateSelection: false,
    currentStepConfig: { id: 'basics', title: 'Basics', description: '', fields: [] },
    progress: 0,
    isTemplateStep: false,
    isLastStep: true,
    handleNext: vi.fn(),
    handlePrevious: vi.fn(),
    handleSkip: vi.fn(),
    handleStepClick: vi.fn(),
    handleTemplateSelect: vi.fn(),
    handleTemplateOnlySelect: vi.fn(),
    handleCancel: vi.fn(),
  }),
}));

// Relative on purpose: vitest.config.ts aliases '@/components/ui/tabs' to a
// pass-through stub for the rest of the suite.
import { Tabs, TabsList, TabsTrigger } from '../../../src/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DictationButton } from '@/components/ui/DictationButton';
import { ActorSelector } from '@/components/create/ActorSelector';
import { OWNER_ME } from '@/components/create/owner';
import { WizardTemplateOnlyView } from '@/components/create/WizardTemplateOnlyView';
import { EntityCreationWizard } from '@/components/create/EntityCreationWizard';
import { WalletForm } from '@/components/wallets/WalletManager/components/WalletForm';
import { SocialLinksEditor } from '@/components/profile/SocialLinksEditor';
import IntelligentOnboarding from '@/components/onboarding/IntelligentOnboarding';
import { AuthFormBody } from '@/app/auth/AuthFormBody';
import { OtpForm } from '@/app/auth/reset-password/OtpForm';
import type { EntityConfig } from '@/components/create/types';

const TOUCH_44 = /(^|\s)pointer-coarse:min-h-11(\s|$)/;
const ALWAYS_44 = /(^|\s)min-h-11(\s|$)/;

const CONFIG = {
  type: 'product',
  pageTitle: 'Create Product',
  pageDescription: 'Sell something',
  templates: [],
  wizardConfig: { enabled: true },
} as unknown as EntityConfig<Record<string, unknown>>;

describe('tabs (My Projects / Favorites and every other shared tab row)', () => {
  it('a tab is 44px on touch, and the row grows to hold it', () => {
    render(
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My Projects</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>
      </Tabs>
    );
    expect(screen.getByRole('tab', { name: 'My Projects' }).className).toMatch(TOUCH_44);
    // A fixed h-9 clipped the row at 36px whatever the tabs inside needed.
    expect(screen.getByRole('tablist').className).not.toMatch(/(^|\s)h-9(\s|$)/);
  });
});

describe('avatar', () => {
  it('without a photo there is no <img>, so the fallback shows', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src={undefined} />
        <AvatarFallback>Y</AvatarFallback>
      </Avatar>
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Y')).toBeInTheDocument();
  });

  it('with a photo the <img> is still there', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/a.png" />
        <AvatarFallback>Y</AvatarFallback>
      </Avatar>
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
  });
});

describe('create forms', () => {
  it('the small mic is 44px on touch', () => {
    render(<DictationButton size="sm" ariaLabel="Voice input" onTranscript={() => {}} />);
    const mic = screen.getByRole('button', { name: 'Voice input' });
    expect(mic.className).toMatch(TOUCH_44);
    expect(mic.className).toMatch(/(^|\s)pointer-coarse:min-w-11(\s|$)/);
  });

  it('the owner picker is 44px on touch and shows the icon for a user without a photo', () => {
    const { container } = render(
      <ActorSelector value={OWNER_ME} onChange={() => {}} allowSomeoneElse />
    );
    expect(screen.getByRole('button', { name: /You/ }).className).toMatch(TOUCH_44);
    expect(container.querySelector('img')).toBeNull();
  });

  it('Cancel is 44px on touch on the template page and in the wizard', () => {
    const { unmount } = render(
      <WizardTemplateOnlyView config={CONFIG} onCancel={() => {}} onSelectTemplate={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toMatch(TOUCH_44);
    unmount();

    render(<EntityCreationWizard config={CONFIG} />);
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toMatch(TOUCH_44);
  });
});

describe('wallet form disclosures (/receive and "Pay into" on create forms)', () => {
  it.each(['Add an on-chain address or a wallet connection', 'Name and details'])(
    '"%s" is 44px on touch and says whether it is open',
    name => {
      render(<WalletForm onSubmit={async () => {}} />);
      const toggle = screen.getByRole('button', { name });
      expect(toggle.className).toMatch(TOUCH_44);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
  );
});

describe('social links editor inside the profile form', () => {
  function inProfileForm(ui: React.ReactElement) {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<form onSubmit={onSubmit}>{ui}</form>);
    return onSubmit;
  }

  it('"+ Add Link" opens the link form without saving the profile, and is 44px on touch', () => {
    const onSubmit = inProfileForm(<SocialLinksEditor links={[]} onChange={() => {}} />);
    const add = screen.getByRole('button', { name: '+ Add Link' });
    expect(add.className).toMatch(TOUCH_44);
    fireEvent.click(add);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Add Social Link')).toBeInTheDocument();

    // Neither way out of the link form saves the profile either.
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('"Add Your First Link" does not save the profile', () => {
    const onSubmit = inProfileForm(<SocialLinksEditor links={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Add Your First Link/ }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("a saved link's Edit and Delete do not save the profile", () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onSubmit = inProfileForm(
      <SocialLinksEditor
        links={[{ platform: 'github', value: 'https://github.com/example' }]}
        onChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('onboarding', () => {
  it('"Or just chat with your Cat instead" is 44px', () => {
    render(<IntelligentOnboarding />);
    expect(
      screen.getByRole('button', { name: /Or just chat with your Cat instead/ }).className
    ).toMatch(ALWAYS_44);
  });
});

describe("forgot and reset pages: Can't get to your email?", () => {
  it('is a 44px box on /auth?mode=forgot', () => {
    render(
      <AuthFormBody
        mode="forgot"
        setMode={() => {}}
        formData={{ email: '', password: '', confirmPassword: '' }}
        setFormData={() => {}}
        showPassword={false}
        setShowPassword={() => {}}
        showConfirmPassword={false}
        setShowConfirmPassword={() => {}}
        loading={false}
        captchaEnabled={false}
        turnstileSiteKey={undefined}
        handleCaptchaSuccess={() => {}}
        handleCaptchaError={() => {}}
        handleCaptchaExpire={() => {}}
        rememberMe={false}
        setRememberMe={() => {}}
        handleSubmit={() => {}}
        handleForgotPassword={() => {}}
      />
    );
    const link = screen.getByRole('link', { name: "Can't get to your email?" });
    expect(link.className).toMatch(/(^|\s)inline-flex(\s|$)/);
    expect(link.className).toMatch(ALWAYS_44);
  });

  it('is a 44px box on /auth/reset-password', () => {
    render(<OtpForm onVerified={() => {}} onRequestNewReset={() => {}} />);
    const link = screen.getByRole('link', { name: "Can't get to your email?" });
    expect(link.className).toMatch(/(^|\s)inline-flex(\s|$)/);
    expect(link.className).toMatch(ALWAYS_44);
  });
});
