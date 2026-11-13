// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormField } from '@/components/create/FormField';
import { productConfig } from '@/config/entity-configs/product-config';
import { projectConfig } from '@/config/entity-configs/project-config';
import type { FieldConfig } from '@/components/create/types';

const fields = (groups: { fields?: FieldConfig[] }[]) => groups.flatMap(g => g.fields ?? []);

describe('a sentinel the person never types', () => {
  const inventory = fields(productConfig.fieldGroups).find(f => f.name === 'inventory_count')!;

  it('shows -1 (unlimited) as an empty "Unlimited" field', () => {
    render(<FormField config={inventory} value={-1} onChange={() => {}} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('Unlimited');
  });

  it('clearing the field stores unlimited again', () => {
    const onChange = vi.fn();
    render(<FormField config={inventory} value={5} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(-1);
  });
});

describe('create form copy', () => {
  it('no hint explains the implementation or says "Optional:"', () => {
    for (const field of [
      ...fields(productConfig.fieldGroups),
      ...fields(projectConfig.fieldGroups),
    ]) {
      const hint = field.hint ?? '';
      expect(hint.startsWith('Optional:')).toBe(false);
      expect(hint).not.toContain('-1');
      expect(hint).not.toContain('selector is included');
    }
  });

  it('radios and checkboxes are 20px, drawn in ink', () => {
    render(
      <FormField
        config={{ name: 'show', label: 'Show', type: 'checkbox' }}
        value={false}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('checkbox').className).toMatch(/h-5 w-5.*accent-fg-primary/);
  });
});
