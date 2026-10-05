// @vitest-environment jsdom
/**
 * The Cat's "+" menu, rendered: one file input per source.
 *
 * A single input with a mixed accept (image/* plus text extensions) is what an
 * Android phone answers with a chooser of capture apps — Camera, Recorder,
 * "Photos & Videos" — and no file browser. Attaching a screenshot from a phone
 * was effectively impossible (2026-10-05).
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposerAddMenu } from '@/components/ai-chat/ModernChatPanel/components/ComposerAddMenu';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

const renderMenu = (onFiles = vi.fn()) =>
  render(<ComposerAddMenu attachable={[]} onFiles={onFiles} onReference={vi.fn()} />);

describe('ComposerAddMenu', () => {
  it('renders three inputs, none with a mixed accept', () => {
    const { container } = renderMenu();
    const inputs = Array.from(container.querySelectorAll('input[type="file"]'));
    const by = Object.fromEntries(inputs.map(i => [i.getAttribute('data-attach-source'), i]));
    expect(Object.keys(by)).toEqual(['camera', 'photos', 'files']);
    expect(by.camera.getAttribute('accept')).toBe('image/*');
    expect(by.camera.getAttribute('capture')).toBe('environment');
    expect(by.photos.getAttribute('accept')).toBe('image/*');
    expect(by.files.hasAttribute('accept')).toBe(false);
  });

  it('each menu item opens its own picker, and a pick reaches onFiles', () => {
    const onFiles = vi.fn();
    const { container } = renderMenu(onFiles);
    const files = container.querySelector('input[data-attach-source="files"]') as HTMLInputElement;
    const click = vi.spyOn(files, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Add files and more' }));
    for (const label of ['Take a photo', 'Photo library', 'Files']) {
      expect(screen.getByRole('menuitem', { name: new RegExp(label) })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('menuitem', { name: /Files/ }));
    expect(click).toHaveBeenCalledOnce();
    const file = new File(['hello'], 'notes.md', { type: 'text/markdown' });
    fireEvent.change(files, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledOnce();
  });
});
