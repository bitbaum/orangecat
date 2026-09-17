// @vitest-environment jsdom
/**
 * The segmented control existed three times by copy-paste before this. What the
 * shared version must keep true is the part the copies were getting subtly
 * different: a segment that navigates has to be a real link (middle-click,
 * open-in-new-tab, `aria-current`), and one that only changes local state has
 * to be a button that announces its pressed state.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

describe('SegmentedControl', () => {
  const BUTTON_ITEMS = [
    { value: 'person', label: 'To a person' },
    { value: 'invoice', label: 'Paste invoice' },
  ];

  it('renders href-bearing segments as real links', () => {
    render(
      <SegmentedControl
        label="Money"
        value="/send"
        items={[
          { value: '/receive', href: '/receive', label: 'Receive' },
          { value: '/send', href: '/send', label: 'Send' },
        ]}
      />
    );

    const send = screen.getByRole('link', { name: 'Send' });
    expect(send).toHaveAttribute('href', '/send');
    expect(send).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Receive' })).not.toHaveAttribute('aria-current');
  });

  it('renders stateful segments as buttons that report being pressed', () => {
    render(
      <SegmentedControl
        label="Send method"
        value="person"
        items={BUTTON_ITEMS}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'To a person' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Paste invoice' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('reports the value that was chosen', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Send method"
        value="person"
        items={BUTTON_ITEMS}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Paste invoice' }));
    expect(onChange).toHaveBeenCalledWith('invoice');
  });

  it('names the group so the choice is not an anonymous row of words', () => {
    render(
      <SegmentedControl
        label="Send method"
        value="person"
        items={BUTTON_ITEMS}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('group', { name: 'Send method' })).toBeInTheDocument();
  });

  it('keeps every segment at a thumb-sized touch target', () => {
    render(
      <SegmentedControl
        label="Send method"
        value="person"
        items={BUTTON_ITEMS}
        onChange={() => {}}
      />
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-11');
    }
  });
});
