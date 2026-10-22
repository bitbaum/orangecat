import { useProjectStore, selectDraftProjects, type Project } from '@/stores/projectStore';
vi.mock('@/lib/supabase/browser', () => ({ default: {} }));
vi.mock('@/domain/actors', () => ({ getUserActorId: vi.fn() }));

afterEach(() => useProjectStore.getState().reset());
it('derives current draft and active counts after repeated Zustand state merges', () => {
  const project = { id: 'p1', title: 'A draft', isDraft: true, isActive: false } as Project;
  useProjectStore.setState({ projects: [project] });
  useProjectStore.setState({ isLoading: true });
  expect(selectDraftProjects(useProjectStore.getState())).toHaveLength(1);
  useProjectStore.setState({ projects: [{ ...project, isDraft: false, isActive: true }] });
  useProjectStore.setState({ isLoading: false });
  expect(selectDraftProjects(useProjectStore.getState())).toHaveLength(0);
  expect(useProjectStore.getState().getStats()).toMatchObject({ totalProjects: 1, totalActive: 1 });
  useProjectStore.getState().reset();
  expect(useProjectStore.getState().getStats().totalActive).toBe(0);
});
