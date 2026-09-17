// @vitest-environment jsdom
/**
 * AIAssistChip — the tap target for every AI suggestion.
 *
 * These chips are the primary one-tap action on mobile, so the 44px minimum
 * touch target from the frontend rules is a hard requirement, not styling
 * taste. The chips this replaced were roughly half that.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIAssistChip } from '@/components/create/AIAssistChip';

describe('AIAssistChip', () => {
  it('meets the 44px minimum touch target', () => {
    render(<AIAssistChip label="Longer description" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Longer description' })).toHaveClass('min-h-11');
  });

  it('is a real button, so it is keyboard reachable and not a submit', () => {
    render(<AIAssistChip label="Better tags" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Better tags' })).toHaveAttribute('type', 'button');
  });

  it('is not clickable while disabled', () => {
    const onClick = vi.fn();
    render(<AIAssistChip label="Shorter description" onClick={onClick} disabled />);

    const chip = screen.getByRole('button', { name: 'Shorter description' });
    expect(chip).toBeDisabled();
    chip.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('goes full width on mobile when asked, for long example text', () => {
    render(<AIAssistChip label="A long starter example…" onClick={vi.fn()} block />);

    expect(screen.getByRole('button', { name: /long starter example/ })).toHaveClass(
      'w-full',
      'sm:w-auto'
    );
  });
});
