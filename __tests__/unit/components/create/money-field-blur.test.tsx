// @vitest-environment jsdom
/**
 * Money fields are checked when they lose focus, like titles and numbers
 * (full-path review 2026-11-13, create#3): FormField did not hand `onBlur` to
 * the currency input, so "-5" or "CHF 0.001" sat in the price field with no
 * word until submit.
 */
import { render, fireEvent } from '@testing-library/react';
import { useEntityFormState } from '@/components/create/EntityForm/hooks/useEntityFormState';
import { FormFieldGroups } from '@/components/create/EntityForm/components/FormFieldGroups';
import { currencyFieldIssue } from '@/components/create/EntityForm/hooks/currencyFieldIssue';
import { productConfig } from '@/config/entity-configs/product-config';
import type { EntityConfig } from '@/components/create/types';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

type Data = Record<string, unknown>;

function Form() {
  const entity = productConfig as unknown as EntityConfig<Data>;
  const state = useEntityFormState({
    config: entity,
    userCurrency: 'CHF',
    userId: 'u',
    mode: 'create',
  });
  return (
    <FormFieldGroups
      visibleFieldGroups={entity.fieldGroups.filter(g => g.id === 'pricing')}
      isGroupVisible={() => true}
      isFieldVisible={() => true}
      formState={state.formState}
      handleFieldChange={state.handleFieldChange}
      handleFieldFocus={() => undefined}
      handleFieldBlur={state.validateField}
      aiGeneratedFields={state.aiGeneratedFields}
    />
  );
}

function typeAndLeave(value: string) {
  const input = document.getElementById('price') as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
  return input;
}

beforeEach(() => localStorage.clear());

describe('a price field on blur', () => {
  it('says a negative price is wrong, with the schema’s words', () => {
    const { getByText } = render(<Form />);
    const input = typeAndLeave('-5');
    expect(getByText('Price must be positive')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('says a franc price finer than a cent is a Bitcoin amount in the wrong unit', () => {
    const { getByText } = render(<Form />);
    typeAndLeave('0.001');
    expect(getByText(/CHF amounts stop at the cent/)).toBeTruthy();
  });

  it('says nothing about a good price', () => {
    const { queryByText } = render(<Form />);
    const input = typeAndLeave('25');
    expect(queryByText('Price must be positive')).toBeNull();
    expect(queryByText(/stop at the cent/)).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('currencyFieldIssue', () => {
  const money = { type: 'currency' as const };
  it('allows whole cents and any BTC amount', () => {
    expect(currencyFieldIssue(money, 9.99, 'CHF')).toBeNull();
    expect(currencyFieldIssue(money, 0.00012345, 'BTC')).toBeNull();
    expect(currencyFieldIssue({ ...money, storedIn: 'BTC' }, 0.00012345, 'CHF')).toBeNull();
  });
  it('flags fiat below the cent', () => {
    expect(currencyFieldIssue(money, 0.001, 'EUR')).toMatch(/EUR amounts stop at the cent/);
  });
  it('ignores fields that are not money', () => {
    expect(currencyFieldIssue({ type: 'number' }, 0.001, 'CHF')).toBeNull();
  });
});
