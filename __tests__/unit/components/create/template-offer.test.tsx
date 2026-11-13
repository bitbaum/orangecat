// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateTemplateOffer } from '@/components/create/CreateTemplateOffer';
import { WizardTemplatePicker } from '@/components/create/templates/WizardTemplatePicker';
import { showAIPrefill } from '@/components/create/EntityForm/index';

const TEMPLATES = [
  { id: 'bakery', icon: null, name: 'Bakery', tagline: 'Bread on Saturdays', defaults: {} },
  { id: 'ebook', icon: null, name: 'Ebook', tagline: 'A book you wrote', defaults: {} },
];

describe('templates are an offer, not a gate', () => {
  it('nothing is checked until someone picks a template', () => {
    render(<WizardTemplatePicker templates={TEMPLATES} onSelectTemplate={() => {}} />);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(screen.queryByText('Start from scratch')).toBeNull();
  });

  it('the applied template is the one marked', () => {
    render(
      <WizardTemplatePicker
        templates={TEMPLATES}
        selectedTemplateId="ebook"
        onSelectTemplate={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /Ebook/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Bakery/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Start from a template" opens the list; a pick applies it and closes the sheet', () => {
    const onSelect = vi.fn();
    render(<CreateTemplateOffer templates={TEMPLATES} onSelectTemplate={onSelect} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start from a template' }));
    fireEvent.click(screen.getByRole('button', { name: /Bakery/ }));
    expect(onSelect).toHaveBeenCalledWith(TEMPLATES[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a type without templates shows no offer', () => {
    const { container } = render(
      <CreateTemplateOffer templates={[]} onSelectTemplate={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the AI bar in a wizard', () => {
  it('shows on a single-page form and on the first step only', () => {
    expect(showAIPrefill()).toBe(true);
    expect(showAIPrefill({ currentStep: 0 })).toBe(true);
    expect(showAIPrefill({ currentStep: 1 })).toBe(false);
  });
});
