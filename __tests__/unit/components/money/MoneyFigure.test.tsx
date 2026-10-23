// @vitest-environment jsdom
/**
 * An amount is set in two voices: the number large, the unit small and beside
 * it. splitMoney only reads the string the app already formatted, so the
 * figure can never disagree with the rest of the product about how an amount
 * is spelled — it has to survive every spelling that string can take.
 */

import { render, screen } from '@testing-library/react';
import { MoneyFigure, splitMoney } from '@/components/money/MoneyFigure';

describe('splitMoney', () => {
  it.each([
    ['CHF 19.78', 'CHF', '19.78', ''],
    ['$1,234.50', '$', '1,234.50', ''],
    ['€5.00', '€', '5.00', ''],
    ['0.00023 BTC', '', '0.00023', 'BTC'],
    ['1,234.00 EUR', '', '1,234.00', 'EUR'],
    ["CHF 1'234.50", 'CHF', "1'234.50", ''],
    ['₿0.001', '₿', '0.001', ''],
  ])('reads %s', (label, prefix, number, suffix) => {
    expect(splitMoney(label)).toEqual({ prefix, number, suffix });
  });

  it('hands back what it cannot read, whole, rather than drop it', () => {
    expect(splitMoney('Free')).toEqual({ prefix: '', number: 'Free', suffix: '' });
  });
});

describe('MoneyFigure', () => {
  it('sets the number and the unit apart', () => {
    render(<MoneyFigure label="CHF 19.78" size="hero" />);
    expect(screen.getByText('19.78').className).toContain('text-figure');
    expect(screen.getByText('CHF').className).toContain('text-fg-tertiary');
  });
});
