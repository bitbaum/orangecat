// @vitest-environment jsdom
/**
 * The Cat's "+" menu, rendered: chatkit's attach sheet with one file input per
 * source, and OrangeCat's own rows under the three sources.
 *
 * A single input with a mixed accept (image/* plus text extensions) is what an
 * Android phone answers with a chooser of capture apps — Camera, Recorder,
 * "Photos & Videos" — and no file browser. Attaching a screenshot from a phone
 * was effectively impossible (2026-10-05).
 */
import { acceptFamilies } from '@bitbaum/chatkit';
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

const renderMenu = (onFiles = vi.fn()) =>
  render(<ComposerAddMenu attachable={[]} onFiles={onFiles} onReference={vi.fn()} />);

describe('ComposerAddMenu', () => {
  it('renders three inputs, none with a mixed accept', () => {
    const { container } = renderMenu();
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const by = Object.fromEntries(inputs.map(i => [i.getAttribute('data-ck-source'), i]));
    expect(Object.keys(by)).toEqual(['camera', 'photos', 'files']);
    expect(by.camera.getAttribute('accept')).toBe('image/*');
    expect(by.camera.getAttribute('capture')).toBe('environment');
    expect(by.photos.getAttribute('accept')).toBe('image/*');
    // Files asks for documents (or, before chatkit 0.20.1, for nothing) — never
    // for pictures or sound, which is what puts the camera chooser in front
    // of the file browser on Android.
    const filesAccept = by.files.getAttribute('accept') ?? '';
    expect(acceptFamilies(filesAccept).filter(f => f !== 'document')).toEqual([]);
  });

  it('opens a sheet with the sources and the Cat rows; a pick reaches onFiles', () => {
    const onFiles = vi.fn();
    const { container } = renderMenu(onFiles);
    const files = container.querySelector('input[data-ck-source="files"]') as HTMLInputElement;
    const click = vi.spyOn(files, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Add files and more' }));
    expect(container.querySelector('dialog[open]')).toBeTruthy();
    for (const label of ['Take a photo', 'Photo library', 'Files']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: /Context documents/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Connections/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Files$/ }));
    expect(click).toHaveBeenCalledOnce();
    const file = new File(['hello'], 'notes.md', { type: 'text/markdown' });
    fireEvent.change(files, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledOnce();
  });
});
