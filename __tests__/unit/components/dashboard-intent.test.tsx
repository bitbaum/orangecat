// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardIntent } from '@/components/dashboard/DashboardIntent';
import { CAT_DOOR } from '@/config/cat-door';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('dashboard intent through the shared composer', () => {
  beforeEach(() => push.mockReset());

  it('encodes intent as data and retains the draft until navigation succeeds', async () => {
    render(<DashboardIntent />);
    const input = screen.getByRole('textbox', { name: CAT_DOOR.prompt });
    expect(document.activeElement).not.toBe(input);
    const text = 'Write an article & explain ?q=hello #world';
    fireEvent.change(input, { target: { value: `  ${text}  ` } });
    fireEvent.click(screen.getByRole('button', { name: CAT_DOOR.submit }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/dashboard/cat?q=${encodeURIComponent(text)}`)
    );
    expect(input).toHaveValue(`  ${text}  `);
  });

  it('blocks short or oversized input without truncating the user’s words', () => {
    render(<DashboardIntent />);
    const input = screen.getByRole('textbox', { name: CAT_DOOR.prompt });
    fireEvent.change(input, { target: { value: ' a ' } });
    expect(screen.getByRole('button', { name: CAT_DOOR.submit })).toBeDisabled();
    const long = 'a'.repeat(CAT_DOOR.maxLength + 1);
    fireEvent.change(input, { target: { value: long } });
    expect(screen.getByRole('alert')).toHaveTextContent('500 characters');
    expect(input).toHaveValue(long);
    expect(screen.getByRole('button', { name: CAT_DOOR.submit })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });
});
