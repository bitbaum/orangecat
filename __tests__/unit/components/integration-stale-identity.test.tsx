// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntegrationKeysCard from '@/components/settings/IntegrationKeysCard';
import WebhookEndpointsCard from '@/components/settings/WebhookEndpointsCard';
const actors = [{ actor_id: 'review-identity', label: 'Review identity' }];
afterEach(() => vi.unstubAllGlobals());
it.each(['key', 'endpoint'] as const)(
  'does not mint a %s with an identity no longer available',
  async kind => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { keys: [], endpoints: [] } }) });
    vi.stubGlobal('fetch', fetcher);
    const Card = kind === 'key' ? IntegrationKeysCard : WebhookEndpointsCard;
    const { rerender, container } = render(
      <Card actors={actors} defaultActorId="review-identity" />
    );
    await userEvent.click(
      screen.getByText(kind === 'key' ? 'Create a new key' : 'Create a new endpoint', {
        exact: true,
      })
    );
    const name = screen.getByRole('textbox', { name: 'Name', exact: true });
    await userEvent.type(name, 'Review fixture');
    if (kind === 'endpoint')
      await userEvent.type(
        screen.getByRole('textbox', { name: 'Target URL (https in production)', exact: true }),
        'https://example.com/review'
      );
    const submit = screen.getByRole('button', {
      name: kind === 'key' ? 'Create key' : 'Create endpoint',
      exact: true,
    });
    await waitFor(() => expect(submit).toBeEnabled());
    rerender(<Card actors={[]} defaultActorId={null} />);
    expect(submit).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  }
);

it('requests only the selected read scope, with no write permission', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { keys: [] } }) })
    .mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Review request stopped; no credential created' }),
    });
  vi.stubGlobal('fetch', fetcher);
  render(<IntegrationKeysCard actors={actors} defaultActorId="review-identity" />);
  await userEvent.click(screen.getByText('Create a new key', { exact: true }));
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Name', exact: true }),
    'Review fixture'
  );
  await userEvent.click(
    screen.getByRole('radio', {
      name: 'Restrict to specific scopes (least privilege).',
      exact: true,
    })
  );
  await userEvent.click(screen.getByRole('checkbox', { name: 'Read project', exact: true }));
  expect(screen.getByRole('checkbox', { name: 'Write project', exact: true })).not.toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'Create key', exact: true }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true)
  );
  const request = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')![1];
  expect(JSON.parse(request.body)).toEqual({
    name: 'Review fixture',
    actor_id: 'review-identity',
    scopes: ['project.read'],
  });
});
