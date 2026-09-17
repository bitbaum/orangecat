import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import { NextRouter } from 'next/router';
import { ReactNode } from 'react';

interface TestWrapperProps {
  children: ReactNode;
  router?: Partial<NextRouter>;
}

const createRouter = (router?: Partial<NextRouter>): NextRouter => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  reload: vi.fn(),
  forward: vi.fn(),
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
  basePath: '',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
  beforePopState: vi.fn(),
  ...router,
});

export function TestWrapper({ children, router }: TestWrapperProps) {
  const mockRouter = createRouter(router);

  if (typeof window !== 'undefined') {
    // @ts-ignore - Set global mockRouter for tests
    window.mockRouter = mockRouter;
  }

  return <RouterContext.Provider value={mockRouter}>{children}</RouterContext.Provider>;
}
