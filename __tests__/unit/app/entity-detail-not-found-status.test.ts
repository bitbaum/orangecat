/**
 * A missing product, service, cause, loan, event or investment answers 404.
 *
 * Measured on production (2026-11-12, 390px, signed out, light and dark):
 * /products/00000000-0000-0000-0000-000000000000 answered 200 with the title
 * "Product Not Found", and so did the same id under /services, /causes, /loans,
 * /events and /investments. The same id under /assets, /wishlists, /research,
 * /companions and /projects answered 404.
 *
 * Each of the six had a loading.tsx on its [id] segment, and /events, /loans
 * and /investments one more on the list segment above. That boundary streams
 * the skeleton first, so Next.js commits 200 before PublicEntityDetailPage
 * reaches notFound(). Link checkers, uptime monitors, CDN caches and share-link
 * validators read the status, not the HTML.
 *
 * audit:routes did not catch it: it read only the page's own source, and these
 * pages hand the existence check to PublicEntityDetailPage.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  findSoftNotFoundPages,
  loadingBoundariesAbove,
  notFoundSource,
} from '../../../scripts/lib/soft-status.mjs';

const SRC = join(process.cwd(), 'src');
const APP = join(SRC, 'app');

const ENTITY_DETAIL_ROUTES = ['products', 'services', 'causes', 'loans', 'events', 'investments'];

describe('public entity detail pages keep their 404', () => {
  it.each(ENTITY_DETAIL_ROUTES)('/%s/[id] has no loading.tsx above its notFound()', route => {
    const page = join(APP, route, '[id]', 'page.tsx');
    // The check is made in the shared component, one import away.
    expect(notFoundSource(page, SRC)).toBe(
      join(SRC, 'components/public/PublicEntityDetailPage.tsx')
    );
    expect(loadingBoundariesAbove(page, APP)).toEqual([]);
  });

  it('no public page streams before its notFound()', () => {
    // Pages behind sign-in are allowlisted in audit-routes.mjs: signed out they
    // redirect to /auth, so nothing outside the session reads their status.
    const soft = findSoftNotFoundPages({ appDir: APP, srcDir: SRC })
      .filter(({ segment }) => !segment.startsWith('(authenticated)'))
      .map(({ segment }) => segment);
    expect(soft).toEqual([]);
  });
});

describe('soft-status rule (audit:routes)', () => {
  let root: string;
  const write = (path: string, body: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  const LOADING = 'export default function Loading() { return null; }\n';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'soft-status-'));
    write(
      'src/components/Detail.tsx',
      "import { notFound } from 'next/navigation';\n" +
        'export type DetailProps = { id: string };\n' +
        'export default async function Detail({ id }: DetailProps) {\n' +
        '  if (!id) notFound();\n' +
        '  return null;\n' +
        '}\n'
    );
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const soft = () =>
    findSoftNotFoundPages({ appDir: join(root, 'src/app'), srcDir: join(root, 'src') }).map(
      ({ segment, checkedIn, boundaries }) => ({
        segment,
        checkedIn: checkedIn.slice(root.length + 1),
        boundaries: boundaries.map((b: string) => b.slice(root.length + 1)),
      })
    );

  it('flags a page whose imported component calls notFound() under its own loading.tsx', () => {
    write(
      'src/app/things/[id]/page.tsx',
      "import Detail from '@/components/Detail';\n" +
        'export default function Page() { return <Detail id="x" />; }\n'
    );
    write('src/app/things/[id]/loading.tsx', LOADING);

    expect(soft()).toEqual([
      {
        segment: 'things/[id]',
        checkedIn: 'src/components/Detail.tsx',
        boundaries: ['src/app/things/[id]/loading.tsx'],
      },
    ]);
  });

  it("flags the list segment's loading.tsx above a detail page, through a relative import", () => {
    write(
      'src/app/things/[id]/page.tsx',
      "import Detail from '../../../components/Detail';\n" +
        'export default function Page() { return <Detail id="x" />; }\n'
    );
    write('src/app/things/loading.tsx', LOADING);

    expect(soft()).toEqual([
      {
        segment: 'things/[id]',
        checkedIn: 'src/components/Detail.tsx',
        boundaries: ['src/app/things/loading.tsx'],
      },
    ]);
  });

  it('ignores type-only imports, comments, and pages with no boundary above', () => {
    write(
      'src/app/typed/[id]/page.tsx',
      "import type { DetailProps } from '@/components/Detail';\n" +
        'export default function Page(_: DetailProps) { return null; }\n'
    );
    write('src/app/typed/[id]/loading.tsx', LOADING);
    write(
      'src/app/commented/[id]/page.tsx',
      '// This page never calls notFound(); it always renders.\n' +
        'export default function Page() { return null; }\n'
    );
    write('src/app/commented/[id]/loading.tsx', LOADING);
    write(
      'src/app/plain/[id]/page.tsx',
      "import Detail from '@/components/Detail';\n" +
        'export default function Page() { return <Detail id="x" />; }\n'
    );

    expect(soft()).toEqual([]);
  });
});
