// @vitest-environment jsdom
/**
 * Delete on a published event used to confirm "will be removed", report
 * success, and leave the event live. The dialog now says what will happen and
 * offers the move that takes it offline; a draft still deletes.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeleteEntityButton } from '@/components/entity/DeleteEntityButton';
import { API_ROUTES } from '@/config/api-routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ID = '66666666-6666-4666-8666-666666666666';
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
});

describe('DeleteEntityButton', () => {
  it('a published event offers Unpublish, not Delete, and PATCHes it to draft', async () => {
    render(
      <DeleteEntityButton
        entityType="event"
        entityId={ID}
        entityTitle="Night"
        entityStatus="published"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.getByText(/take this event offline first/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(API_ROUTES.ENTITIES.STATUS('event', ID));
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'draft' });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('a draft event deletes', async () => {
    render(
      <DeleteEntityButton
        entityType="event"
        entityId={ID}
        entityTitle="Night"
        entityStatus="draft"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe(`${ENTITY_REGISTRY.event.apiEndpoint}/${ID}`);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});
