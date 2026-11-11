// @vitest-environment jsdom
/**
 * The Cat's "Your things": rows in chatkit's own attach sheet (under Camera ·
 * Photos · Files, `composer.attachExtras`) and the picker the first one opens.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  YourThingsSheet,
  yourThingsRows,
} from '@/components/ai-chat/ModernChatPanel/components/YourThings';

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

const renderSheet = (onReference = vi.fn(), onClose = vi.fn()) =>
  render(
    <YourThingsSheet
      open
      onClose={onClose}
      attachable={[{ type: 'product', id: 'p1', title: 'Loki Pro' }]}
      onReference={onReference}
    />
  );

describe('Your things', () => {
  it("are three rows of chatkit's attach sheet, each saying what it opens", () => {
    const openThings = vi.fn();
    const go = vi.fn();
    const rows = yourThingsRows({ openThings, go });
    expect(rows.map(r => r.label)).toEqual([
      'One of your things',
      'Context documents',
      'Connections & keys',
    ]);
    rows[0].onPick();
    expect(openThings).toHaveBeenCalled();
    rows[1].onPick();
    rows[2].onPick();
    expect(go).toHaveBeenCalledTimes(2);
  });

  it("the picker holds no file inputs (pictures and files are chatkit's)", () => {
    renderSheet();
    expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
  });

  it('a pick reaches onReference and closes the picker', () => {
    const onReference = vi.fn();
    const onClose = vi.fn();
    renderSheet(onReference, onClose);
    expect(document.querySelector('dialog[open]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Loki Pro/ }));
    expect(onReference).toHaveBeenCalledWith({ type: 'product', id: 'p1', title: 'Loki Pro' });
    expect(onClose).toHaveBeenCalled();
  });
});
