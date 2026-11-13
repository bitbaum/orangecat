// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { focusFirstInvalidField } from '@/components/create/EntityForm/hooks/focusFirstInvalidField';
import type { FieldGroup } from '@/components/create/types';

const GROUPS = [
  { id: 'a', title: 'A', fields: [{ name: 'title', label: 'Title', type: 'text' }] },
  { id: 'b', title: 'B', fields: [{ name: 'price', label: 'Price', type: 'currency' }] },
] as FieldGroup[];

function mount(html: string) {
  document.body.innerHTML = html;
  for (const el of Array.from(document.querySelectorAll('input'))) {
    (el as HTMLElement).scrollIntoView = vi.fn();
  }
}

describe('a failed submit brings the person to the field in error', () => {
  it('goes to the first failing field in form order, not error order', () => {
    mount('<input id="title" /><input id="price" />');
    expect(focusFirstInvalidField(GROUPS, ['price', 'title'])).toBe('title');
    const title = document.getElementById('title')!;
    expect(document.activeElement).toBe(title);
    expect(title.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
  });

  it('skips a field that is not on screen (another wizard step)', () => {
    mount('<div class="hidden"><input id="title" /></div><input id="price" />');
    expect(focusFirstInvalidField(GROUPS, ['title', 'price'])).toBe('price');
  });

  it('does nothing without errors or without a rendered field', () => {
    mount('');
    expect(focusFirstInvalidField(GROUPS, [])).toBeNull();
    expect(focusFirstInvalidField(GROUPS, ['title'])).toBeNull();
  });
});
