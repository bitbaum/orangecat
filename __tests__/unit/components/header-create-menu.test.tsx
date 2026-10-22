// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderCreateButton } from '@/components/dashboard/HeaderCreateButton';

vi.mock('@/components/create/VoiceCreate', () => ({ VoiceCreate: () => null }));

describe('header create menu', () => {
  it('opens a portalled article link, closes on Escape, and restores trigger focus', async () => {
    const user = userEvent.setup();
    const { container } = render(<HeaderCreateButton />);
    const trigger = screen.getByRole('button', { name: 'Create new' });
    await user.click(trigger);
    const article = await screen.findByRole('menuitem', { name: /Article/ });
    expect(article).toHaveAttribute('href', '/articles/new');
    expect(container).not.toContainElement(article);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('opens from the keyboard and reaches the article with no pointer', async () => {
    const user = userEvent.setup();
    render(<HeaderCreateButton />);
    screen.getByRole('button', { name: 'Create new' }).focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Article/ })).toHaveFocus());
  });
});
