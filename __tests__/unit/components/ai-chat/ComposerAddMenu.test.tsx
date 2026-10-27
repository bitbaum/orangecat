// @vitest-environment jsdom
/**
 * The Cat's "Your things", rendered: chatkit's sheet with the person's own
 * things and the Cat rows. Camera · Photos · Files are chatkit's own attach
 * button in ChatApp's composer (one input per source, never a mixed accept).
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ComposerAddMenu } from '@/components/ai-chat/ModernChatPanel/components/ComposerAddMenu';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

// jsdom has no top layer: the sheet's <dialog> opens by attribute here.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: () => void;
  };
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
});

afterEach(cleanup);

const renderMenu = (onReference = vi.fn()) =>
  render(
    <ComposerAddMenu
      attachable={[{ type: 'product', id: 'p1', title: 'Loki Pro' }]}
      onReference={onReference}
    />
  );

describe('ComposerAddMenu', () => {
  it("holds only what is OrangeCat's: no file inputs (pictures and files are chatkit's)", () => {
    const { container } = renderMenu();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });

  it('opens a sheet of your things and the Cat rows; a pick reaches onReference', () => {
    const onReference = vi.fn();
    renderMenu(onReference);
    fireEvent.click(screen.getByRole('button', { name: 'Add one of your things' }));
    expect(document.querySelector('dialog[open]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Context documents/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Connections/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Loki Pro/ }));
    expect(onReference).toHaveBeenCalledWith({ type: 'product', id: 'p1', title: 'Loki Pro' });
  });
});
