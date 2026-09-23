// @vitest-environment jsdom
/**
 * The paste step has to show a failure. Saving a destination and then
 * hiding the error would leave the person on a form that can create a second one.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingPay } from '@/components/onboarding/OnboardingPay';

describe('OnboardingPay', () => {
  it('says it is reading, and does not offer another paste while it does', () => {
    render(<OnboardingPay profileId={undefined} busy onDone={() => undefined} />);

    expect(screen.getByRole('status').textContent).toMatch(/finding offers/i);
    expect(screen.queryByText(/Sign in again/)).toBeNull();
  });

  it('shows a failed generation and a way into the chat', async () => {
    const onChat = vi.fn();
    render(
      <OnboardingPay
        profileId={undefined}
        error="Could not generate suggestions right now — you can still chat with your Cat."
        onChat={onChat}
        onDone={() => undefined}
      />
    );

    expect(screen.getByText(/Could not generate suggestions/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: /chat with your Cat/ }));
    expect(onChat).toHaveBeenCalledOnce();
  });
});
