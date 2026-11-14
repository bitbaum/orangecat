// @vitest-environment jsdom
/**
 * The hero's one action: type a name, claim orangecat.ch/pay/<name>. The page
 * the name makes is shown as it is typed, and a name somebody has is refused
 * before the visitor is sent to sign up for it.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import ClaimLinkForm, {
  claimNameProblem,
  cleanClaimName,
} from '@/components/home/sections/ClaimLinkForm';
import { registerHrefKeepingSentence } from '@/config/cat-door';
import { HERO_COPY } from '@/config/landing-page';
import { PAY_COPY } from '@/config/pay';

const { claim } = HERO_COPY;
const fetchMock = vi.fn();

function answer(status: string) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { status } }) });
}

beforeEach(() => {
  router.push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('a pay-link name', () => {
  it('keeps only what a name may hold', () => {
    expect(cleanClaimName('Anna Müller!')).toBe('Anna-Mller');
    expect(cleanClaimName('x'.repeat(40))).toHaveLength(30);
  });

  it('is refused here when malformed or reserved', () => {
    expect(claimNameProblem('ab')).toBe(claim.invalid);
    expect(claimNameProblem('admin')).toBe(claim.unavailable);
    expect(claimNameProblem('anna')).toBeNull();
  });
});

describe('ClaimLinkForm', () => {
  it('shows the page the name makes, as it is typed', async () => {
    render(<ClaimLinkForm />);
    expect(screen.getByText(PAY_COPY.title('your-name'))).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(claim.label), 'anna');
    expect(screen.getByText(PAY_COPY.title('anna'))).toBeInTheDocument();
    expect(screen.getByText('orangecat.ch/pay/anna')).toBeInTheDocument();
  });

  it('claims a free name: sign-up, then the Cat with the sentence that sets it', async () => {
    answer('available');
    render(<ClaimLinkForm />);
    await userEvent.type(screen.getByLabelText(claim.label), 'anna');
    await userEvent.click(screen.getByRole('button', { name: claim.submit }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        registerHrefKeepingSentence(claim.catSentence('anna'))
      )
    );
    expect(fetchMock.mock.calls[0][0]).toContain('/api/pay/name?name=anna');
  });

  it('refuses a taken name and sends nobody to sign up for it', async () => {
    answer('taken');
    render(<ClaimLinkForm />);
    await userEvent.type(screen.getByLabelText(claim.label), 'anna');
    await userEvent.click(screen.getByRole('button', { name: claim.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(claim.unavailable);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('says what a name needs before asking the server', async () => {
    render(<ClaimLinkForm />);
    await userEvent.click(screen.getByRole('button', { name: claim.submit }));
    expect(screen.getByRole('alert')).toHaveTextContent(claim.invalid);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not block the claim when the check cannot be made', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<ClaimLinkForm />);
    await userEvent.type(screen.getByLabelText(claim.label), 'anna');
    await userEvent.click(screen.getByRole('button', { name: claim.submit }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });
});
