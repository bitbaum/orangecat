import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectProductRecord } from '@/app/projects/[id]/product-record';
import { getFleetProject } from '@/domain/projectRooms/evidence/loki';

vi.mock('@/domain/projectRooms/evidence/loki', () => ({ getFleetProject: vi.fn() }));

it('renders the canonical product identity and development record without copying it into the project row', async () => {
  vi.mocked(getFleetProject).mockResolvedValue({
    name: 'Language tutor',
    status: 'beta',
    since: null,
    urls: { live: null, repo: null },
    identity: {
      problem: 'A sourced problem.',
      solution: 'A sourced solution.',
      mission: 'A sourced mission.',
      vision: 'A sourced vision.',
    },
    roadmap: [
      { title: 'The next learning milestone', line: 'A sourced next step.', status: 'planned' },
    ],
    changelog: [{ date: '2026-11-01', done: 'A sourced improvement shipped.' }],
    sources: { roadmap: 'https://example.com/roadmap', changelog: 'https://example.com/changelog' },
  });
  const content = await ProjectProductRecord({ projectId: 'real-project-reference' });
  const html = renderToStaticMarkup(content);
  expect(getFleetProject).toHaveBeenCalledWith('real-project-reference');
  for (const text of [
    'A sourced problem.',
    'A sourced solution.',
    'A sourced mission.',
    'A sourced vision.',
    'The next learning milestone',
    'A sourced improvement shipped.',
  ])
    expect(html).toContain(text);
});
it('leaves the project profile usable when the neighbouring record cannot be read', async () => {
  vi.mocked(getFleetProject).mockResolvedValue(null);
  expect(await ProjectProductRecord({ projectId: 'real-project-reference' })).toBeNull();
});
