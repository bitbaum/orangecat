// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TasksSection from '@/components/dashboard/TasksSection';
import { TASK_DEFINITIONS } from '@/services/recommendations/tasks';
import { DashboardHeader } from '@/components/dashboard/sections/DashboardHeader';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'review-viewer' }, profile: { username: 'reviewer' } }),
}));
vi.mock('@/hooks/useRecommendations', () => ({
  useRecommendations: () => ({
    isLoading: false,
    error: null,
    profileCompletion: 50,
    taskCompletion: 50,
    tasks: Array.from({ length: 6 }, (_, i) => ({
      id: `setup-${i}`,
      title: `Profile task ${i}`,
      description: 'Optional profile details',
      priority: 'high',
      action: { label: `Open task ${i}`, href: '/dashboard/info/edit' },
    })),
    questions: [],
    celebration: null,
    markTaskCompleted: vi.fn(),
    completedTaskIds: new Set(),
    refresh: vi.fn(),
  }),
}));

afterEach(cleanup);

it('reveals the remaining tasks when Show more is pressed', () => {
  render(<TasksSection maxTasks={4} />);
  expect(screen.queryByText('Profile task 5')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show 2 more tasks' }));
  expect(screen.getByText('Profile task 5')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Show .* more tasks/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse tasks' }));
  expect(screen.queryByText('Profile task 5')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Expand tasks' }));
  expect(screen.getByText('Profile task 5')).toBeVisible();
});

it('presents wallet connection as a suggestion rather than a setup blocker', () => {
  expect(TASK_DEFINITIONS.find(task => task.id === 'add-wallet')?.priority).toBe('medium');
  render(<TasksSection />);
  expect(screen.queryByText('Important')).toBeNull();
  expect(screen.getByRole('button', { name: 'Mark as complete: Profile task 0' })).toBeVisible();
});

it('does not greet a guest by a generated identifier', () => {
  render(
    <DashboardHeader profile={{ username: 'user_d35e21b04b6b' }} waiting={0} totalDrafts={0} />
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Welcome back$/);
});

it('keeps a chosen display name even while the handle is generated', () => {
  render(
    <DashboardHeader
      profile={{ name: 'Alex', username: 'user_d35e21b04b6b' }}
      waiting={0}
      totalDrafts={0}
    />
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back, Alex');
});

it('keeps setup usable when browser preferences cannot be read', () => {
  vi.mocked(localStorage.getItem).mockImplementationOnce(() => {
    throw new Error('Storage unavailable');
  });
  render(<TasksSection />);
  expect(screen.getByText('Set up your profile')).toBeVisible();
});
