// @vitest-environment jsdom
/**
 * The floating Cat panel on orangecat.ch (2026-11-12): Escape to close the
 * model menu (or any sheet inside the panel) closed the whole panel, and the
 * message being typed went with it.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import GlobalCatLauncher from '@/components/ai-chat/GlobalCatLauncher';

vi.mock('next/navigation', () => ({ usePathname: () => '/discover' }));
vi.mock('@/hooks/useSoftKeyboard', () => ({ useSoftKeyboard: () => false }));
vi.mock('@/components/ai-chat/ModernChatPanel/index', () => ({
  // Stands in for the chat: a model menu that is open until its own Escape.
  ModernChatPanel: function Panel() {
    const [menu, setMenu] = useState(true);
    return menu ? (
      <div
        role="menu"
        aria-label="Choose a model"
        tabIndex={-1}
        onKeyDown={e => e.key === 'Escape' && setMenu(false)}
      />
    ) : (
      <p>composer</p>
    );
  },
}));

describe('Escape in the floating Cat', () => {
  it('closes the open menu first, and only then the panel', () => {
    render(<GlobalCatLauncher />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Cat about this page' }));

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Cat' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Cat' })).not.toBeInTheDocument();
  });
});

vi.mock('@/hooks/useAvailableModels', () => ({
  useAvailableModels: () => ({ access: null, loading: false }),
}));
vi.mock('@/services/ai/local-runtime', () => ({ probeAllLocalRuntimesCached: async () => [] }));
let phone = true;
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => phone }));

import { ModelSelector } from '@/components/ai-chat/ModernChatPanel/components/ModelSelector';

describe('the model menu', () => {
  const renderIn = () =>
    render(
      <div data-testid="composer" style={{ backdropFilter: 'blur(4px)' }}>
        <ModelSelector selectedModel="auto" onSelect={() => {}} />
      </div>
    );

  it('on a phone is a sheet outside the composer, so it stays on screen and its scrim covers the page', () => {
    phone = true;
    renderIn();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const menu = screen.getByRole('menu', { name: 'Choose a model' });
    expect(screen.getByTestId('composer').contains(menu)).toBe(false);
    expect(menu.className).toContain('inset-x-3');
  });

  it('from sm up stays anchored to its trigger', () => {
    phone = false;
    renderIn();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const menu = screen.getByRole('menu', { name: 'Choose a model' });
    expect(screen.getByTestId('composer').contains(menu)).toBe(true);
  });
});
