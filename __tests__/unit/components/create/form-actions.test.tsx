// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormActions } from '@/components/create/EntityForm/components/FormActions';
import { WalletForm } from '@/components/wallets/WalletManager/components/WalletForm';

const ALWAYS_44 = /(^|\s)min-h-11(\s|$)/;

describe('create form actions', () => {
  it('Create and Cancel are an equal pair of 44px buttons, Create first', () => {
    render(<FormActions isSubmitting={false} mode="create" entityName="Product" backUrl="/x" />);
    const create = screen.getByRole('button', { name: 'Create Product' });
    const cancel = screen.getByRole('link', { name: 'Cancel' });
    for (const control of [create, cancel]) {
      expect(control.className).toMatch(ALWAYS_44);
      expect(control.className).toMatch(/(^|\s)w-full(\s|$)/);
    }
    expect(create.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('wizard Previous and Next are the same pair', () => {
    render(
      <FormActions
        isSubmitting={false}
        mode="create"
        entityName="Project"
        backUrl="/x"
        wizardMode={{
          currentStep: 1,
          totalSteps: 3,
          visibleFields: [],
          onNext: () => {},
          onPrevious: () => {},
        }}
      />
    );
    for (const name of ['Previous', 'Next']) {
      expect(screen.getByRole('button', { name }).className).toMatch(ALWAYS_44);
    }
  });
});

describe('the wallet box inside a create form', () => {
  it('its heading no longer depends on the button label', () => {
    render(<WalletForm onSubmit={async () => {}} submitLabel="Use this wallet" />);
    expect(screen.getByRole('heading', { name: 'Get paid in Bitcoin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this wallet' })).toBeInTheDocument();
  });

  it('an outline save leaves the form one filled button', () => {
    render(
      <WalletForm onSubmit={async () => {}} submitLabel="Use this wallet" submitVariant="outline" />
    );
    const outline = screen.getByRole('button', { name: 'Use this wallet' }).className;
    render(<WalletForm onSubmit={async () => {}} submitLabel="Filled" />);
    const filled = screen.getByRole('button', { name: 'Filled' }).className;
    expect(outline).not.toEqual(filled);
  });
});
