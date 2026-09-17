// @vitest-environment jsdom
/**
 * Tests for useNavigation — specifically the stable-ref fix that prevents
 * the "Maximum update depth exceeded" infinite loop regression.
 *
 * Root cause of the bug: onStateLoaded / onLoadFailed were inline arrow
 * functions passed to useNavigationStorage. That hook's useEffect had them
 * in its dep array, so every render created new references → new effect run
 * → state setters → re-render → new references → infinite loop.
 *
 * Fix: stable useCallback([], []) wrappers backed by refs (see useNavigation.ts).
 * These tests lock in that contract.
 */

import { renderHook, act } from '@testing-library/react';
import { useNavigation } from '@/hooks/useNavigation';
import type { NavSection } from '@/hooks/useNavigation';

// ─── mocks ──────────────────────────────────────────────────────────────────

// Capture the callbacks that useNavigation passes to useNavigationStorage
// so we can assert they are stable across re-renders.
let capturedOnStateLoaded: ((...args: unknown[]) => void) | undefined;
let capturedOnLoadFailed: ((...args: unknown[]) => void) | undefined;

vi.mock('@/hooks/useNavigationStorage', () => ({
  buildInitialCollapsedSections: vi.fn(() => new Set<string>()),
  clearNavigationStorage: vi.fn(),
  useNavigationStorage: vi.fn(
    (
      _hydrated: boolean,
      _sections: NavSection[],
      {
        onStateLoaded,
        onLoadFailed,
      }: { onStateLoaded: (...args: unknown[]) => void; onLoadFailed: (...args: unknown[]) => void }
    ) => {
      capturedOnStateLoaded = onStateLoaded;
      capturedOnLoadFailed = onLoadFailed;
      return {
        persistSidebarState: vi.fn(),
        persistSidebarCollapsedState: vi.fn(),
        persistCollapsedSections: vi.fn(),
      };
    }
  ),
}));

vi.mock('@/hooks/useActiveNavItem', () => ({
  useActiveNavItem: vi.fn(() => ({
    activeSection: null,
    activeItem: null,
    isItemActive: vi.fn(() => false),
  })),
}));

// Mock useAuth: hydrated by default, no user/profile.
const mockUseAuth = vi.fn(() => ({
  user: null,
  profile: null,
  hydrated: true,
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

// ─── helpers ────────────────────────────────────────────────────────────────

const simpleSections: NavSection[] = [
  {
    id: 'public',
    title: 'Public',
    items: [{ name: 'Home', href: '/' }],
    priority: 1,
  },
  {
    id: 'auth',
    title: 'Auth Only',
    items: [{ name: 'Dashboard', href: '/dashboard', requiresAuth: true }],
    requiresAuth: true,
    priority: 2,
  },
];

// ─── stable ref regression tests ────────────────────────────────────────────

describe('useNavigation — stable callback refs (regression: infinite loop fix)', () => {
  beforeEach(() => {
    capturedOnStateLoaded = undefined;
    capturedOnLoadFailed = undefined;
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null, hydrated: true });
  });

  it('passes stable onStateLoaded reference across multiple renders', () => {
    const { result, rerender } = renderHook(() => useNavigation(simpleSections));

    const ref1 = capturedOnStateLoaded;
    expect(ref1).toBeDefined();

    // Force a re-render by calling a state-changing toggle
    act(() => {
      result.current.toggleSidebar();
    });

    const ref2 = capturedOnStateLoaded;
    expect(ref2).toBe(ref1); // same reference — no new function created
  });

  it('passes stable onLoadFailed reference across multiple renders', () => {
    const { result, rerender } = renderHook(() => useNavigation(simpleSections));

    const ref1 = capturedOnLoadFailed;
    expect(ref1).toBeDefined();

    act(() => {
      result.current.toggleSidebar();
    });

    const ref2 = capturedOnLoadFailed;
    expect(ref2).toBe(ref1);
  });

  it('stable refs survive toggleSection calls (state changes)', () => {
    const { result } = renderHook(() => useNavigation(simpleSections));

    const loadedRef = capturedOnStateLoaded;
    const failedRef = capturedOnLoadFailed;

    act(() => {
      result.current.toggleSection('public');
    });
    act(() => {
      result.current.toggleSection('public');
    });

    expect(capturedOnStateLoaded).toBe(loadedRef);
    expect(capturedOnLoadFailed).toBe(failedRef);
  });
});

// ─── getFilteredSections ────────────────────────────────────────────────────

describe('useNavigation — getFilteredSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when not hydrated', () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, hydrated: false });
    const { result } = renderHook(() => useNavigation(simpleSections));
    expect(result.current.getFilteredSections()).toHaveLength(0);
  });

  it('returns only public sections when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, hydrated: true });
    const { result } = renderHook(() => useNavigation(simpleSections));
    const sections = result.current.getFilteredSections();
    expect(sections.map(s => s.id)).toEqual(['public']);
  });

  it('returns all sections when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' },
      profile: { id: 'p1' },
      hydrated: true,
    });
    const { result } = renderHook(() => useNavigation(simpleSections));
    const sections = result.current.getFilteredSections();
    expect(sections.map(s => s.id)).toEqual(['public', 'auth']);
  });

  it('filters out requiresAuth items from visible sections', () => {
    const mixed: NavSection[] = [
      {
        id: 'mixed',
        title: 'Mixed',
        items: [
          { name: 'Public item', href: '/public' },
          { name: 'Auth item', href: '/private', requiresAuth: true },
        ],
        priority: 1,
      },
    ];
    mockUseAuth.mockReturnValue({ user: null, profile: null, hydrated: true });
    const { result } = renderHook(() => useNavigation(mixed));
    const sections = result.current.getFilteredSections();
    expect(sections).toHaveLength(1);
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].items[0].href).toBe('/public');
  });

  it('sorts sections by priority', () => {
    const unordered: NavSection[] = [
      { id: 'c', title: 'C', items: [{ name: 'C' }], priority: 3 },
      { id: 'a', title: 'A', items: [{ name: 'A' }], priority: 1 },
      { id: 'b', title: 'B', items: [{ name: 'B' }], priority: 2 },
    ];
    mockUseAuth.mockReturnValue({ user: null, profile: null, hydrated: true });
    const { result } = renderHook(() => useNavigation(unordered));
    const ids = result.current.getFilteredSections().map(s => s.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

// ─── toggle functions ────────────────────────────────────────────────────────

describe('useNavigation — toggle functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null, hydrated: true });
  });

  it('toggleSidebar flips isSidebarOpen', () => {
    const { result } = renderHook(() => useNavigation(simpleSections));
    expect(result.current.navigationState.isSidebarOpen).toBe(false);

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.navigationState.isSidebarOpen).toBe(true);

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.navigationState.isSidebarOpen).toBe(false);
  });

  it('setSidebarOpen sets state directly', () => {
    const { result } = renderHook(() => useNavigation(simpleSections));

    act(() => {
      result.current.setSidebarOpen(true);
    });
    expect(result.current.navigationState.isSidebarOpen).toBe(true);

    act(() => {
      result.current.setSidebarOpen(true);
    }); // no-op
    expect(result.current.navigationState.isSidebarOpen).toBe(true);

    act(() => {
      result.current.setSidebarOpen(false);
    });
    expect(result.current.navigationState.isSidebarOpen).toBe(false);
  });

  it('toggleSidebarCollapse flips isSidebarCollapsed', () => {
    const { result } = renderHook(() => useNavigation(simpleSections));
    expect(result.current.navigationState.isSidebarCollapsed).toBe(false);

    act(() => {
      result.current.toggleSidebarCollapse();
    });
    expect(result.current.navigationState.isSidebarCollapsed).toBe(true);
  });

  it('toggleSection adds/removes from collapsedSections', () => {
    const { result } = renderHook(() => useNavigation(simpleSections));

    act(() => {
      result.current.toggleSection('public');
    });
    expect(result.current.navigationState.collapsedSections.has('public')).toBe(true);

    act(() => {
      result.current.toggleSection('public');
    });
    expect(result.current.navigationState.collapsedSections.has('public')).toBe(false);
  });

  it('resetNavigation clears all state', () => {
    const { result } = renderHook(() => useNavigation(simpleSections));

    act(() => {
      result.current.setSidebarOpen(true);
      result.current.setSidebarCollapsed(true);
    });

    act(() => {
      result.current.resetNavigation();
    });

    expect(result.current.navigationState.isSidebarOpen).toBe(false);
    expect(result.current.navigationState.isSidebarCollapsed).toBe(false);
  });
});
