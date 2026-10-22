// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatNudges } from '@/components/dashboard/CatNudges';

it('a failed concurrent dismissal restores only its own row and reports the failure', async () => {
  let failFirst!: (value: Response) => void;
  const first = new Promise<Response>(resolve => {
    failFirst = resolve;
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              nudges: [
                { id: '1', title: 'First suggestion', body: 'First body' },
                { id: '2', title: 'Second suggestion', body: 'Second body' },
              ],
            },
          })
        )
      )
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(new Response('{}'))
  );
  render(<CatNudges />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Hide: First suggestion' }));
  await user.click(screen.getByRole('button', { name: 'Hide: Second suggestion' }));
  await screen.findByText('Suggestion hidden.');
  failFirst(new Response('{}', { status: 500 }));
  await waitFor(() => expect(screen.getByText('First suggestion')).toBeVisible());
  expect(screen.queryByText('Second suggestion')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent("Couldn't hide this suggestion");
  vi.unstubAllGlobals();
});
