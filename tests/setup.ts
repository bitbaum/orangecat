import '@testing-library/jest-dom';

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock window.alert
window.alert = vi.fn();
