// @vitest-environment jsdom
/**
 * Shared controls are announced with a name and a value.
 *
 * Measured on 2026-11-12: axe `button-name` on 88 nodes (the Cat permission
 * switches and their expanders were buttons with no name), and every progress
 * bar announced as indeterminate, because Progress took `value` out of its
 * props and never handed it to the Radix root.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import { CategoryRow } from '@/components/cat-settings/permissions/CategoryRow';
import { CatProactivityToggle } from '@/components/ai/CatProactivityToggle';
import { WizardProgressBar } from '@/components/create/WizardProgressBar';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import type { CategorySummary } from '@/components/cat-settings/permissions/types';

const payments: CategorySummary = {
  category: 'payments',
  name: 'Payments',
  description: 'Send and request money',
  enabled: false,
  actionCount: 3,
  enabledActionCount: 0,
};

const step = (id: string, title: string) => ({ id, title, description: '', fields: [] });

function renderRow(isExpanded: boolean, onToggleCategory = vi.fn()) {
  return render(
    <CategoryRow
      cat={payments}
      actions={[]}
      isExpanded={isExpanded}
      saving={null}
      onToggleExpanded={() => {}}
      onToggleCategory={onToggleCategory}
      onSetAutonomy={() => {}}
    />
  );
}

describe('control names', () => {
  it('a Cat permission switch says what it allows', () => {
    const onToggleCategory = vi.fn();
    renderRow(false, onToggleCategory);
    const toggle = screen.getByRole('switch', { name: 'Allow Payments' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onToggleCategory).toHaveBeenCalledWith('payments', true);
  });

  it('a Cat permission expander has a name, a state and a 44px box', () => {
    const { unmount } = renderRow(false);
    const closed = screen.getByRole('button', { name: 'Show Payments actions' });
    expect(closed.getAttribute('aria-expanded')).toBe('false');
    expect(closed.className).toMatch(/\bh-11\b/);
    expect(closed.className).toMatch(/\bw-11\b/);
    unmount();

    renderRow(true);
    expect(
      screen.getByRole('button', { name: 'Hide Payments actions' }).getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('"Let Cat bring things up" is the shared Switch, named, and reports the new state', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(<CatProactivityToggle enabled onToggle={onToggle} />);
    const toggle = screen.getByRole('switch', { name: 'Let Cat bring things up' });
    expect(toggle.getAttribute('data-state')).toBe('checked');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  // Two hand-built switches painted their track with classes that emit
  // nothing (`bg-accent-primary`) or the card's own colour, so the control was
  // a dot with no track; a third had no name. The Radix root sets the role
  // itself, so a literal role="switch" in src is a hand-built one.
  it('every switch is the shared Switch', () => {
    const root = join(process.cwd(), 'src');
    const handBuilt = (readdirSync(root, { recursive: true }) as string[])
      .filter(file => file.endsWith('.tsx'))
      .filter(file => /role=["']switch["']/.test(readFileSync(join(root, file), 'utf8')))
      .map(file => relative(root, join(root, file)));
    expect(handBuilt).toEqual([]);
  });

  it('the Switch track is 44px wide with a 44px hit area, and off is a visible outline', () => {
    render(<Switch aria-label="Example" />);
    const classes = screen.getByRole('switch').className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        'h-6',
        'w-11',
        'after:absolute',
        'after:-inset-y-3',
        'data-[state=unchecked]:border-fg-tertiary',
        'data-[state=checked]:bg-primary',
      ])
    );
  });

  it('a progress bar announces its value', () => {
    render(<Progress value={25} aria-label="Funding progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Funding progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    expect(bar.getAttribute('data-state')).toBe('loading');
  });

  it('a percentage past either end is clamped, not announced as indeterminate', () => {
    const { rerender } = render(<Progress value={180} aria-label="Raised" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<Progress value={-5} aria-label="Raised" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    rerender(<Progress value={Number.NaN} aria-label="Raised" />);
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('the wizard bar is named, reads as a step count, and marks the current step', () => {
    render(
      <WizardProgressBar
        wizardSteps={[
          step('basics', 'Basics'),
          step('details', 'Details'),
          step('review', 'Review'),
          step('publish', 'Publish'),
        ]}
        currentStep={1}
        completedSteps={new Set([0])}
        progress={50}
        onStepClick={() => {}}
      />
    );
    const bar = screen.getByRole('progressbar', { name: 'Progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(bar.getAttribute('aria-valuetext')).toBe('Step 2 of 4');
    expect(screen.getByRole('button', { name: /Details/ }).getAttribute('aria-current')).toBe(
      'step'
    );
    expect(screen.getByRole('button', { name: /Basics/ }).hasAttribute('aria-current')).toBe(false);
  });
});
