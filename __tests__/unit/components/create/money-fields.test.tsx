// @vitest-environment jsdom
/**
 * Money fields on the create forms (live review of orangecat.ch at 390px,
 * 2026-11-12, nothing submitted):
 * - Changing one control's currency re-labelled every other amount: a CHF 25
 *   product became 25 BTC when its "Default Currency" was set to Bitcoin, and
 *   a CHF 8,000 loan balance became 8,000 BTC when Loan Amount's switch moved.
 * - Price, Loan Amount and Remaining Balance started as "0.00": a tap and
 *   "25" entered 0.0025, the field then read "0.00", and "positive" passed.
 * - The asset form took its sale, rental and deposit prices as bare BTC
 *   numbers; its Rental Apartment template asked 0.025 BTC a day.
 * - The currency switch had no accessible name ("CHF, combo box").
 */
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { useEntityFormState } from '@/components/create/EntityForm/hooks/useEntityFormState';
import { FormFieldGroups } from '@/components/create/EntityForm/components/FormFieldGroups';
import {
  convertFormAmounts,
  NO_RATE_FOR_SWITCH,
} from '@/components/create/EntityForm/hooks/convertFormAmounts';
import { useCurrencyInput } from '@/components/ui/useCurrencyInput';
import { FormField } from '@/components/create/FormField';
import { applyRateSnapshot, cache } from '@/services/currency/rates';
import { productConfig } from '@/config/entity-configs/product-config';
import { loanConfig } from '@/config/entity-configs/loan-config';
import { assetConfig } from '@/config/entity-configs/asset-config';
import { ASSET_TEMPLATES } from '@/components/create/templates/asset-templates';
import { userProductSchema, loanSchema } from '@/lib/validation';
import type { EntityConfig, FieldConfig } from '@/components/create/types';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

type Data = Record<string, unknown>;
const BTC_CHF = 60000;

function withRates() {
  applyRateSnapshot({ rates: { CHF: BTC_CHF, EUR: 55000 }, fetchedAt: Date.now() });
}

function form(config: unknown) {
  return renderHook(() =>
    useEntityFormState({
      config: config as EntityConfig<Data>,
      userCurrency: 'CHF',
      userId: 'u',
      mode: 'create',
    })
  );
}

/** The form as the create page wires it, limited to the named sections. */
function Form({
  config,
  groups,
  initialValues,
}: {
  config: unknown;
  groups: string[];
  initialValues?: Data;
}) {
  const entity = config as EntityConfig<Data>;
  const state = useEntityFormState({
    config: entity,
    initialValues,
    userCurrency: 'CHF',
    userId: 'u',
    mode: 'create',
  });
  return (
    <FormFieldGroups
      visibleFieldGroups={entity.fieldGroups.filter(g => groups.includes(g.id))}
      isGroupVisible={() => true}
      isFieldVisible={() => true}
      formState={state.formState}
      handleFieldChange={state.handleFieldChange}
      handleFieldFocus={() => undefined}
      handleFieldBlur={() => undefined}
      aiGeneratedFields={state.aiGeneratedFields}
    />
  );
}

function type(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
  return input;
}

const typed = (value: string) => ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>;

beforeEach(() => {
  localStorage.clear();
  cache.rates = {};
  cache.lastUpdated = null;
  cache.expiresAt = null;
});

describe('switching a form’s currency', () => {
  it('converts every amount, so a loan balance is never re-labelled', () => {
    withRates();
    const { result } = form(loanConfig);
    act(() => {
      result.current.handleFieldChange('original_amount', 10000);
      result.current.handleFieldChange('remaining_balance', 8000);
    });
    // Loan Amount's own switch moves to BTC.
    act(() => result.current.handleFieldChange('currency', 'BTC'));

    expect(result.current.formState.data).toMatchObject({
      currency: 'BTC',
      original_amount: 0.16666667,
      remaining_balance: 0.13333333,
    });
  });

  it("the product's Currency select converts the price instead of re-labelling it", () => {
    withRates();
    const { result } = form(productConfig);
    act(() => result.current.handleFieldChange('price', 25));
    act(() => result.current.handleFieldChange('currency', 'BTC'));
    expect(result.current.formState.data.price).toBe(0.00041667);

    act(() => result.current.handleFieldChange('currency', 'CHF'));
    expect(result.current.formState.data.price).toBe(25);
  });

  it('is refused, not written as 0, when there is no rate', () => {
    const { result } = form(productConfig);
    act(() => result.current.handleFieldChange('price', 25));
    act(() => result.current.handleFieldChange('currency', 'BTC'));

    expect(result.current.formState.data).toMatchObject({ currency: 'CHF', price: 25 });
    expect(result.current.formState.errors.price).toBe(NO_RATE_FOR_SWITCH);
  });

  it('leaves an amount kept in BTC alone and converts the rest', () => {
    withRates();
    const fields = assetConfig.fieldGroups.flatMap(g => g.fields ?? []);
    const out = convertFormAmounts(
      { estimated_value: 850000, rental_price_btc: 0.05 },
      fields,
      'CHF',
      'BTC'
    );
    expect(out).toEqual({ ok: true, amounts: { estimated_value: 14.16666667 } });
  });
});

describe('on the form', () => {
  it("moving Loan Amount's switch converts Still owed with it", () => {
    withRates();
    render(<Form config={loanConfig} groups={['loan_terms']} />);
    const amount = type('original_amount', '10000');
    const balance = type('remaining_balance', '8000');

    fireEvent.change(screen.getByRole('combobox', { name: 'Loan Amount currency' }), {
      target: { value: 'BTC' },
    });

    expect(amount.value).toBe('0.16666667');
    expect(balance.value).toBe('0.13333333');
    expect(
      (screen.getByRole('combobox', { name: 'Still owed currency' }) as HTMLSelectElement).value
    ).toBe('BTC');
  });

  it('typing 25 into an untouched price enters 25', () => {
    render(<Form config={productConfig} groups={['pricing']} />);
    const price = document.getElementById('price') as HTMLInputElement;
    expect(price.value).toBe('');
    expect(type('price', '25').value).toBe('25.00');
  });

  it('shows a rent kept in BTC in francs, and in BTC once switched', () => {
    withRates();
    render(
      <Form
        config={assetConfig}
        groups={['details', 'rental']}
        initialValues={{ estimated_value: 850000, currency: 'CHF', rental_price_btc: 0.05 }}
      />
    );
    const rent = document.getElementById('rental_price_btc') as HTMLInputElement;
    expect(rent.value).toBe('3000.00');

    fireEvent.change(screen.getByRole('combobox', { name: 'Rental Price currency' }), {
      target: { value: 'BTC' },
    });
    expect(rent.value).toBe('0.05');
    expect((document.getElementById('estimated_value') as HTMLInputElement).value).toBe(
      '14.16666667'
    );
  });
});

describe('a money field', () => {
  it('hands its switch to the form and does not convert its own amount', () => {
    const onChange = vi.fn();
    const onCurrencyChange = vi.fn();
    const { result } = renderHook(() =>
      useCurrencyInput('CHF', 25, onChange, onCurrencyChange, 'CHF', 'CHF', false)
    );
    act(() => result.current.handleCurrencyChange('BTC'));
    expect(onCurrencyChange).toHaveBeenCalledWith('BTC');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an amount kept in BTC in the form currency and stores what is typed as BTC', () => {
    withRates();
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCurrencyInput('BTC', 0.05, onChange, vi.fn(), 'CHF', 'CHF', false, 'CHF')
    );
    expect(result.current.inputCurrency).toBe('CHF');
    expect(result.current.localValue).toBe('3000.00');

    act(() => result.current.handleInputChange(typed('2400')));
    expect(onChange).toHaveBeenLastCalledWith(0.04);
  });

  it('is typed in BTC, not converted to 0, while there is no rate', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCurrencyInput('BTC', 0.05, onChange, vi.fn(), 'CHF', 'CHF', false, 'CHF')
    );
    expect(result.current.inputCurrency).toBe('BTC');
    expect(result.current.localValue).toBe('0.05');
  });

  it('never rounds a stored fiat amount to a different number', () => {
    const { result } = renderHook(() =>
      useCurrencyInput('CHF', 0.0025, vi.fn(), undefined, 'CHF', 'CHF', false)
    );
    expect(result.current.localValue).toBe('0.0025');
  });

  it('names its currency switch after the field', () => {
    const price = productConfig.fieldGroups
      .flatMap(g => g.fields ?? [])
      .find(f => f.name === 'price') as FieldConfig;
    render(<FormField config={price} value={null} onChange={vi.fn()} currency="CHF" />);
    expect(screen.getByRole('combobox', { name: 'Price currency' })).toBeTruthy();
  });
});

describe('required money fields', () => {
  it('start empty, and say so when left empty', () => {
    expect(productConfig.defaultValues.price).toBeUndefined();
    expect(loanConfig.defaultValues.original_amount).toBeUndefined();
    expect(loanConfig.defaultValues.remaining_balance).toBeUndefined();

    const product = userProductSchema.safeParse({ ...productConfig.defaultValues, title: 'Mug' });
    expect(product.error?.issues.find(i => i.path[0] === 'price')?.message).toBe('Enter a price');

    const loan = loanSchema.safeParse({ ...loanConfig.defaultValues, title: 'Van loan' });
    const messages = Object.fromEntries(
      (loan.error?.issues ?? []).map(i => [String(i.path[0]), i.message])
    );
    expect(messages.original_amount).toBe('Enter the loan amount');
    // A new loan owes all of it: "Still owed" is not asked, and not required.
    expect(messages.remaining_balance).toBeUndefined();
  });
});

describe('what is still owed', () => {
  const field = loanConfig.fieldGroups
    .flatMap(g => g.fields ?? [])
    .find(f => f.name === 'remaining_balance');

  it('is asked only of a loan being refinanced', () => {
    expect(field?.showWhen).toEqual({ field: 'loan_type', value: 'existing_refinance' });
    expect(field?.required).toBeFalsy();
  });

  it('is cleared when the loan type changes, so a hidden balance is never sent', () => {
    const loanType = loanConfig.fieldGroups
      .flatMap(g => g.fields ?? [])
      .find(f => f.name === 'loan_type');
    expect(loanType?.clearOnChange).toContain('remaining_balance');
  });
});

describe('the asset form', () => {
  it('enters sale, rental and deposit prices like every other amount, kept in BTC', () => {
    const fields = assetConfig.fieldGroups.flatMap(g => g.fields ?? []);
    for (const name of ['sale_price_btc', 'rental_price_btc', 'deposit_amount_btc']) {
      const field = fields.find(f => f.name === name);
      expect(field).toMatchObject({ type: 'currency', storedIn: 'BTC' });
      expect(field?.label).not.toMatch(/BTC/);
    }
    expect(fields.find(f => f.name === 'estimated_value')?.type).toBe('currency');
  });

  it("the Rental Apartment template asks a month's rent, not a night's", () => {
    const apartment = ASSET_TEMPLATES.find(t => t.id === 'rental-apartment')?.defaults;
    expect(apartment?.rental_period_type).toBe('monthly');
    const rentChf = (apartment?.rental_price_btc ?? 0) * BTC_CHF;
    expect(rentChf).toBeGreaterThan(1500);
    expect(rentChf).toBeLessThan(6000);
    const depositChf = (apartment?.deposit_amount_btc ?? 0) * BTC_CHF;
    expect(depositChf).toBeLessThanOrEqual(3 * rentChf);
  });
});
