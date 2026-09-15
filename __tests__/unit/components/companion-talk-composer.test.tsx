// @vitest-environment jsdom
/**
 * The room's composer: Enter sends, Shift+Enter breaks a line, blanks never
 * send, and the box clears after a send.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TalkComposer } from '@/components/companions/TalkComposer';

function setup(onSend = vi.fn(async () => {})) {
  render(<TalkComposer name="Mira" onSend={onSend} />);
  const box = screen.getByRole('textbox', { name: /Say something to Mira/ }) as HTMLTextAreaElement;
  return { box, onSend };
}

describe('TalkComposer', () => {
  it('sends on Enter and clears the box', async () => {
    const { box, onSend } = setup();
    fireEvent.change(box, { target: { value: 'What is actually the problem' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('What is actually the problem'));
    expect(box.value).toBe('');
  });

  it('does not send on Shift+Enter', () => {
    const { box, onSend } = setup();
    fireEvent.change(box, { target: { value: 'line one' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    expect(box.value).toBe('line one');
  });

  it('never sends whitespace', () => {
    const { box, onSend } = setup();
    fireEvent.change(box, { target: { value: '   ' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('is inert while disabled', () => {
    const onSend = vi.fn(async () => {});
    render(<TalkComposer name="Mira" onSend={onSend} disabled />);
    const box = screen.getByRole('textbox', { name: /Say something to Mira/ });
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });
});
