// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TASK_TYPES } from '@/config/tasks';
import TasksPage from '@/app/(authenticated)/dashboard/tasks/page';
const { user } = vi.hoisted(() => ({ user: { id: 'own-test-user' } }));
vi.mock('@/hooks/useAuth', () => ({
  useRequireAuth: () => ({ user, hydrated: true, isLoading: false }),
}));
vi.mock('@/components/entity/EntityListShell', () => ({
  default: ({
    headerActions,
    children,
  }: {
    headerActions: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <main>
      {headerActions}
      {children}
    </main>
  ),
}));

describe('task list filters', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('sends the API’s task type and archive keys from named controls', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { tasks: [] } }) });
    vi.stubGlobal('fetch', fetcher);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: TASK_TYPES.RECURRING_SCHEDULED },
    });
    fireEvent.click(screen.getByLabelText('Show archived'));
    await waitFor(() => {
      const url = new URL(fetcher.mock.calls.at(-1)![0], 'https://orangecat.ch');
      expect(url.searchParams.get('task_type')).toBe(TASK_TYPES.RECURRING_SCHEDULED);
      expect(url.searchParams.get('is_archived')).toBe('true');
      expect(url.searchParams.has('type')).toBe(false);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(new URL(fetcher.mock.calls.at(-1)![0], 'https://orangecat.ch').search).toBe('')
    );
  });
  it('keeps the selected result when an older request finishes later', async () => {
    let finishOld!: (value: unknown) => void;
    const old = new Promise(resolve => {
      finishOld = resolve;
    });
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(old)
      .mockResolvedValue({ ok: true, json: async () => ({ data: { tasks: [] } }) });
    vi.stubGlobal('fetch', fetcher);
    render(<TasksPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: TASK_TYPES.RECURRING_SCHEDULED },
    });
    await screen.findByText('No tasks found');
    await act(async () =>
      finishOld({
        ok: true,
        json: async () => ({ data: { tasks: [{ id: 'stale', title: 'Outdated task' }] } }),
      })
    );
    expect(screen.queryByText('Outdated task')).not.toBeInTheDocument();
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
  });

  it('offers a working retry after a failed list request', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Unavailable' }) })
      .mockResolvedValue({ ok: true, json: async () => ({ data: { tasks: [] } }) });
    vi.stubGlobal('fetch', fetcher);
    render(<TasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry loading tasks' }));
    await screen.findByText('No tasks found');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
