// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import BottomSheet from '@/components/ui/BottomSheet';

// jsdom has no layout; leave actual focus behavior to the browser review.
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

function swipe(target: Element, start: number, end: number) {
  fireEvent.touchStart(target, { touches: [{ clientY: start }] });
  fireEvent.touchMove(target, { touches: [{ clientY: end }] });
  fireEvent.touchEnd(target);
}

describe('BottomSheet gestures', () => {
  it('lets content scroll without dismissing; only a downward handle swipe dismisses', () => {
    const close = vi.fn();
    render(
      <BottomSheet isOpen onClose={close} title="Projects">
        <button>Project list</button>
      </BottomSheet>
    );
    swipe(screen.getByRole('button', { name: 'Project list' }), 100, 240);
    expect(close).not.toHaveBeenCalled();
    swipe(document.querySelector('[data-sheet-drag-handle]')!, 100, 240);
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-sheet-drag-handle]')!.parentElement).toHaveStyle({
      transform: 'translateY(0)',
    });
  });

  it('resets the gesture origin so tapping after a short drag cannot dismiss', () => {
    const close = vi.fn();
    render(
      <BottomSheet isOpen onClose={close} title="Projects">
        <button>Project</button>
      </BottomSheet>
    );
    const handle = document.querySelector('[data-sheet-drag-handle]')!;
    swipe(handle, 400, 450);
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(handle);
    expect(close).not.toHaveBeenCalled();
    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(handle, { touches: [{ clientY: 240 }] });
    fireEvent.touchCancel(handle);
    fireEvent.touchEnd(handle);
    expect(close).not.toHaveBeenCalled();
  });

  it('gives simultaneous sheets distinct accessible names', () => {
    render(
      <>
        <BottomSheet isOpen onClose={() => {}} title="Write post">
          <button>Write</button>
        </BottomSheet>
        <BottomSheet isOpen onClose={() => {}} title="Projects">
          <button>Select</button>
        </BottomSheet>
      </>
    );
    const post = screen.getByRole('dialog', { name: 'Write post' });
    const projects = screen.getByRole('dialog', { name: 'Projects' });
    expect(post.getAttribute('aria-labelledby')).not.toBe(projects.getAttribute('aria-labelledby'));
  });
});
