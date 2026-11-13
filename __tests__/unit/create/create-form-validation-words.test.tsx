// @vitest-environment jsdom
/**
 * Create forms on orangecat.ch (2026-11-12):
 * - Number fields showed zod's developer text on blur: "Too small: expected
 *   number to be >=-1", "Invalid input: expected int, received number".
 * - Six create pages opened with "Start from scratch" ticked and no Continue
 *   button: the card that looked chosen was the only way on.
 * - The loan form's Add Asset / Add Wallet icons were squeezed to 4px / 0.8px.
 */
import { render, screen } from '@testing-library/react';
import { userProductSchema, userServiceSchema } from '@/lib/validation/commerce';
import { assetSchema, loanSchema } from '@/lib/validation/finance';
import { WizardTemplatePicker } from '@/components/create/templates/WizardTemplatePicker';
import { COMPONENT_STYLES } from '@/config/design-system';

const firstMessage = (
  schema: { shape: Record<string, { safeParse: (v: unknown) => unknown }> },
  field: string,
  value: unknown
) => {
  const result = schema.shape[field].safeParse(value) as {
    success: boolean;
    error?: { issues: { message: string }[] };
  };
  return result.success ? null : result.error?.issues[0]?.message;
};

describe('number fields speak plainly', () => {
  it.each([
    [userProductSchema, 'inventory_count', -110],
    [userServiceSchema, 'duration_minutes', -5],
    [assetSchema, 'estimated_value', -5],
    [assetSchema, 'max_rental_period', 0],
    [assetSchema, 'min_rental_period', 1.5],
    [loanSchema, 'interest_rate', 150],
    [loanSchema, 'interest_rate', -2],
  ])('%#: %s rejects %s without developer text', (schema, field, value) => {
    const message = firstMessage(schema as never, field as string, value);
    expect(message).toBeTruthy();
    expect(message).not.toMatch(/expected|Invalid input|Too (small|big)|>=|<=/);
  });

  it('says what to do', () => {
    expect(firstMessage(loanSchema as never, 'interest_rate', 150)).toBe('Must be 100 or less');
    expect(firstMessage(assetSchema as never, 'min_rental_period', 1.5)).toBe('Use a whole number');
  });
});

describe('a create page where picking a card is the way on', () => {
  const scratchCard = () =>
    screen.getByText('Start from scratch').closest('button') as HTMLButtonElement;
  const templates = [{ id: 't1', name: 'Cargo bike', description: 'A bike', defaults: {} }];

  it('starts with nothing ticked', () => {
    render(
      <WizardTemplatePicker
        templates={templates as never}
        onSelectTemplate={() => {}}
        preselectScratch={false}
      />
    );
    expect(scratchCard().className).not.toContain('ring-ring/20');
  });

  it('the wizard, which has Next, still starts on Start from scratch', () => {
    render(<WizardTemplatePicker templates={templates as never} onSelectTemplate={() => {}} />);
    expect(scratchCard().className).toContain('ring-ring/20');
  });
});

it('a button never squeezes its icon', () => {
  expect(COMPONENT_STYLES.button.base).toContain('[&_svg]:shrink-0');
});
