// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useSoftKeyboard } from '@/hooks/useSoftKeyboard';

let frame: FrameRequestCallback | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: true }) as MediaQueryList);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  frame = undefined;
});

function Form({ submit }: { submit: () => void }) {
  const keyboard = useSoftKeyboard();
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        submit();
      }}
    >
      <input aria-label="Description" />
      <button type="submit">Next</button>
      <output>{keyboard ? 'Chrome hidden' : 'Chrome visible'}</output>
    </form>
  );
}

it('holds the bottom bar away from a submit tap until the click has completed', () => {
  const submit = vi.fn();
  render(<Form submit={submit} />);
  act(() => screen.getByRole('textbox').focus());
  const button = screen.getByRole('button', { name: 'Next' });
  fireEvent.pointerDown(button);
  act(() => button.focus());
  act(() => vi.runOnlyPendingTimers());
  expect(screen.getByText('Chrome hidden')).toBeInTheDocument();
  fireEvent.pointerUp(button);
  expect(screen.getByText('Chrome hidden')).toBeInTheDocument();
  fireEvent.click(button);
  expect(submit).toHaveBeenCalledTimes(1);
  act(() => frame?.(0));
  expect(screen.getByText('Chrome visible')).toBeInTheDocument();
});

it('restores chrome after keyboard-only blur without waiting for a pointer', () => {
  render(<Form submit={() => {}} />);
  act(() => screen.getByRole('textbox').focus());
  act(() => screen.getByRole('button', { name: 'Next' }).focus());
  act(() => vi.runOnlyPendingTimers());
  expect(screen.getByText('Chrome visible')).toBeInTheDocument();
});
