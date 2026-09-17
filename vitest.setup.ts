/**
 * VITEST SETUP - COMPREHENSIVE TEST ENVIRONMENT
 *
 * Configures the Vitest environment with the mocks, polyfills, and global
 * configuration OrangeCat tests rely on. Ported from jest.setup.ts when the
 * runner moved from jest 30 + ts-jest (CJS) to Vitest (ESM-native).
 */

/* eslint-disable no-console */

import '@testing-library/jest-dom/vitest';
import { vi, beforeEach, afterAll } from 'vitest';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'node:util';

// jsdom ships no TextEncoder/TextDecoder; server-side modules (e.g. the Solon
// Bitcoin-message crypto) use them at import time. Node's are spec-compliant.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder as typeof globalThis.TextEncoder;
  globalThis.TextDecoder = NodeTextDecoder as typeof globalThis.TextDecoder;
}

// -----------------------------------------------------------------------------
// Global Test Environment Configuration
// -----------------------------------------------------------------------------

// Provide sane default environment variables so modules that read them do not
// throw during import when individual test files forget to set them explicitly.
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
process.env.NEXT_PUBLIC_SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'OrangeCat';
process.env = Object.assign({ NODE_ENV: 'test' }, process.env);

// JSDOM already provides localStorage / sessionStorage but not with vi.fn()
// Create spy-able versions so tests can safely mock implementations.
function createStorageMock() {
  const storage: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in storage ? storage[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
    }),
    key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
    get length() {
      return Object.keys(storage).length;
    },
  };
}

// Suites may opt into the node environment (@vitest-environment node) for pure
// server-side code — every browser-global touch below must be conditional.
const IS_JSDOM = typeof window !== 'undefined';

// Replace window.localStorage / sessionStorage with our spy-able mocks.
const localStorageMockInstance = createStorageMock();
const sessionStorageMockInstance = createStorageMock();
if (IS_JSDOM) {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMockInstance,
    writable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMockInstance,
    writable: true,
  });
}

// Prevent React act warnings from polluting test output in older tests.
// (These are warning-level logs; suppress them globally.)
vi.spyOn(console, 'error').mockImplementation((...args) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
    return;
  }
  return (console.error as any).original?.(...args);
});

// Reset the module cache before every test so modules that run side-effects on
// import (e.g. Supabase client which calls createBrowserClient and logger)
// execute fresh.
beforeEach(() => {
  vi.resetModules();
});

// =====================================================================
// 🌍 ENVIRONMENT VARIABLES SETUP
// =====================================================================

// Set up test environment variables
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
Object.defineProperty(process.env, 'NEXT_PUBLIC_SUPABASE_URL', {
  value: 'https://test.supabase.co',
  writable: true,
});
Object.defineProperty(process.env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', {
  value: 'test-anon-key',
  writable: true,
});
Object.defineProperty(process.env, 'SUPABASE_SERVICE_ROLE_KEY', {
  value: 'test-service-role-key',
  writable: true,
});

// =====================================================================
// 🔧 GLOBAL MOCKS & POLYFILLS
// =====================================================================

// Mock fetch globally
global.fetch = vi.fn();

// localStorage / sessionStorage are already replaced above with spy-able,
// store-backed mocks (createStorageMock) — these are just handles to them.
// One mock, one source of truth: don't define a second stub here.
const localStorageMock = localStorageMockInstance;
const sessionStorageMock = sessionStorageMockInstance;

// Mock window.location
if (IS_JSDOM) {
  delete (window as any).location;
  window.location = {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  } as any;
}

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// =====================================================================
// 🎨 LUCIDE ICONS MOCK
// =====================================================================

// Every icon renders as a real `<svg>` carrying its own name, so tests can
// still assert that the right icon appeared — a blanket `() => null` would
// quietly make icon-presence assertions pass on nothing. This used to be a
// hand-written allowlist of ~90 icon names, which meant every icon NOT on the
// list resolved to `undefined` and blew up as "Element type is invalid" — an
// error that reads like a broken component and has twice been debugged as one.
// It lives here as a vi.mock factory (not a resolve.alias to a CJS file):
// the mock is a Proxy so ANY icon name resolves, and CJS interop of an aliased
// Proxy module would surface no named exports (a Proxy has no own keys).
vi.mock('lucide-react', async () => {
  const React = await import('react');

  const iconComponent = (name: string) => {
    const Icon = React.forwardRef<SVGSVGElement, Record<string, any>>((props, ref) =>
      React.createElement('svg', {
        ref,
        'data-testid': props['data-testid'] ?? `icon-${name}`,
        'data-icon': name,
        'aria-hidden': props['aria-hidden'],
        className: props.className,
      })
    );
    Icon.displayName = name;
    return Icon;
  };

  const cache = new Map<string, unknown>();

  return new Proxy(
    {},
    {
      // Vitest verifies an export exists with an `in` check before reading it.
      has(_target, prop) {
        return typeof prop === 'string';
      },
      get(_target, prop) {
        if (prop === '__esModule') {
          return true;
        }
        if (typeof prop !== 'string' || prop === 'default' || prop === 'then') {
          return undefined;
        }
        // `createLucideIcon` and friends are factories, not icons; anything
        // else accessed off this module in a component is an icon.
        if (!cache.has(prop)) {
          cache.set(prop, iconComponent(prop));
        }
        return cache.get(prop);
      },
    }
  );
});

// =====================================================================
// 🔐 AUTH STORE MOCKS
// =====================================================================

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
    session: null,
    profile: null,
    isLoading: false,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    clearError: vi.fn(),
    setUser: vi.fn(),
    setSession: vi.fn(),
    setProfile: vi.fn(),
  })),
}));

// =====================================================================
// 🎨 UI COMPONENT MOCKS
// =====================================================================

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Lucide icons are mocked in __mocks__/lucide-react.js (wired through
// resolve.alias in vitest.config.ts). This used to be a hand-written allowlist
// of ~90 icon names, which meant every icon NOT on the list resolved to
// `undefined` and blew up as "Element type is invalid" — an error that reads
// like a broken component and has twice been debugged as one. A component
// should never need a test-config edit just to use a different icon.

// =====================================================================
// 🧪 TEST UTILITIES
// =====================================================================

// Global test utilities
global.testUtils = {
  // Reset all mocks
  resetMocks: () => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    sessionStorageMock.clear.mockClear();
  },

  // Mock successful API responses
  mockSuccessResponse: (data: any) => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => data,
      text: async () => JSON.stringify(data),
    });
  },

  // Mock error API responses
  mockErrorResponse: (status: number, message: string) => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ error: message }),
      text: async () => message,
    });
  },

  // Mock network error
  mockNetworkError: (message: string = 'Network error') => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error(message));
  },
};

// =====================================================================
// 🔄 SETUP & TEARDOWN
// =====================================================================

// Before each test
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Empty the storage backing stores, then reset call history, so every test
  // starts with clean storage and clean spies.
  localStorageMock.clear();
  sessionStorageMock.clear();
  if (localStorageMock.getItem?.mockClear) {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
  }

  if (sessionStorageMock.getItem?.mockClear) {
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    sessionStorageMock.removeItem.mockClear();
    sessionStorageMock.clear.mockClear();
  }

  // Reset fetch mock
  if (global.fetch && (global.fetch as any).mockClear) {
    (global.fetch as any).mockClear();
  }

  // Reset console mocks
  if ((console.log as any).mockClear) {
    (console.log as any).mockClear();
    (console.warn as any).mockClear();
    (console.error as any).mockClear();
    (console.info as any).mockClear();
    (console.debug as any).mockClear();
  }
});

// After all tests
afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});

// =====================================================================
// 🎯 TYPE DECLARATIONS
// =====================================================================

declare global {
  var testUtils: {
    resetMocks: () => void;
    mockSuccessResponse: (data: any) => void;
    mockErrorResponse: (status: number, message: string) => void;
    mockNetworkError: (message?: string) => void;
  };
}

// =====================================================================
// 🗄️ SUPABASE-JS GLOBAL MOCK (createClient)
// =====================================================================

vi.mock('@supabase/supabase-js', () => {
  // Simple in-memory store per table for rudimentary insert/select/update/delete
  const inMemoryDB: Record<string, any[]> = {};

  function tableStore(name: string) {
    if (!inMemoryDB[name]) {
      inMemoryDB[name] = [];
    }
    return inMemoryDB[name];
  }

  const buildQuery = (table: string, dataset: any[]): any => {
    const builder = {
      _table: table,
      _store: tableStore(table),
      _results: dataset,
      select(this: any, _columns = '*', opts?: any) {
        if (opts && opts.count) {
          return Promise.resolve({ data: this._results, count: this._results.length, error: null });
        }
        return buildQuery(this._table, this._results);
      },
      eq(this: any, column: string, value: any) {
        const filtered = this._results.filter((row: any) => row[column] === value);
        return buildQuery(this._table, filtered);
      },
      order(this: any, column: string, { ascending = true } = {}) {
        const sorted = [...this._results].sort((a, b) => {
          if (a[column] === b[column]) {
            return 0;
          }
          return ascending ? (a[column] > b[column] ? 1 : -1) : a[column] < b[column] ? 1 : -1;
        });
        return buildQuery(this._table, sorted);
      },
      range(this: any, from: number, to: number) {
        const ranged = this._results.slice(from, to + 1);
        return buildQuery(this._table, ranged);
      },
      limit(this: any, count: number) {
        const limited = this._results.slice(0, count);
        return Promise.resolve({ data: limited, error: null });
      },
      single(this: any) {
        if (this._results.length === 0) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: this._results[0], error: null });
      },
      maybeSingle(this: any) {
        if (this._results.length === 0) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: this._results[0], error: null });
      },
      update(this: any, values: any) {
        this._results.forEach((row: any) => Object.assign(row, values));
        return buildQuery(this._table, this._results);
      },
      upsert(this: any, obj: any) {
        const targetArr = this._store;
        const items = Array.isArray(obj) ? obj : [obj];
        items.forEach(item => {
          const existingIdx = targetArr.findIndex((r: any) => r.id === item.id);
          if (existingIdx !== -1) {
            targetArr[existingIdx] = { ...targetArr[existingIdx], ...item };
          } else {
            targetArr.push(item);
          }
        });
        return buildQuery(this._table, items);
      },
      delete(this: any) {
        this._results.forEach((row: any) => {
          const idx = this._store.indexOf(row);
          if (idx !== -1) {
            this._store.splice(idx, 1);
          }
        });
        return Promise.resolve({ data: null, error: null });
      },
      count(this: any) {
        return Promise.resolve({ count: this._results.length, error: null });
      },
    };
    return builder;
  };

  function from(tableName: string) {
    const storeRef = tableStore(tableName);
    const baseBuilder = buildQuery(tableName, storeRef);
    return {
      ...baseBuilder,
      insert(rows: any) {
        const arr = tableStore(tableName);
        const inserted = Array.isArray(rows) ? rows : [rows];
        arr.push(...inserted);
        return buildQuery(tableName, inserted);
      },
    };
  }

  // Seed base data for tests
  const seedProfiles = () => {
    const profiles = tableStore('profiles');
    if (profiles.length === 0) {
      profiles.push(
        {
          id: 'test-user',
          username: 'orangecat',
          display_name: 'Orange Cat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'search-1',
          username: 'searchtest1',
          display_name: 'Search User 1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'search-2',
          username: 'searchtest2',
          display_name: 'Search User 2',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'user-123',
          username: 'existinguser',
          display_name: 'Existing User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );
    }
  };
  seedProfiles();

  const mockClient = {
    from,
    auth: {
      signInWithPassword: vi.fn(({ email }) =>
        Promise.resolve({ data: { user: { id: 'test-user', email } }, error: null })
      ),
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'test-user', email: 'test@example.com' } },
          error: null,
        })
      ),
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: 'token' } }, error: null })
      ),
    },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };

  return {
    __esModule: true,
    createClient: vi.fn(() => mockClient),
  };
});

// Ensure Storage.prototype functions are vi.fn for spying in tests
if (typeof Storage !== 'undefined') {
  Object.defineProperty(Storage.prototype, 'setItem', { value: vi.fn(), writable: true });
  Object.defineProperty(Storage.prototype, 'getItem', { value: vi.fn(), writable: true });
}

// =====================================================================
// 🧪 PROFILE MAPPER MOCKS
// =====================================================================

// Additional mapper mock for Profile tests
vi.mock('@/services/profile/mapper', () => ({
  ProfileMapper: {
    mapDatabaseToProfile: (data: any) => data,
    mapProfileToDatabase: (data: any) => data,
  },
}));

// =====================================================================
// 🧪 PROFILE READER MOCKS
// =====================================================================

vi.mock('@/services/profile/reader', () => {
  return {
    ProfileReader: {
      getProfile: vi.fn(() => Promise.resolve(null)),
      getProfiles: vi.fn(() => Promise.resolve([])),
      searchProfiles: vi.fn(() => Promise.resolve([])),
      getAllProfiles: vi.fn(() => Promise.resolve([])),
      incrementProfileViews: vi.fn(),
    },
  };
});
