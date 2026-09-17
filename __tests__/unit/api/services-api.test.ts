import { POST } from '@/app/api/services/route';
import { createService } from '@/domain/commerce/service';

// Mock the dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/domain/commerce/service', () => ({
  createService: vi.fn(),
}));

vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn(),
  apiUnauthorized: vi.fn(),
  apiInternalError: vi.fn(),
  apiRateLimited: vi.fn(),
  apiValidationError: vi.fn(),
  handleApiError: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn(),
  applyRateLimitHeaders: vi.fn(response => response),
}));

// Handler now routes through resolveCreationActor (added in the actor-switcher
// commit b17b2534). Mock it so the entity create path proceeds without needing
// a real actors table.
vi.mock('@/services/actors/resolveCreationActor', () => ({
  resolveCreationActor: vi.fn().mockResolvedValue({ id: 'actor-123' }),
  ActorNotPermittedError: class ActorNotPermittedError extends Error {},
}));

import { createServerClient } from '@/lib/supabase/server';
import {
  apiSuccess,
  apiUnauthorized,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, applyRateLimitHeaders } from '@/lib/rate-limit';

import type { Mock } from 'vitest';

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
};

const mockRateLimit = {
  success: true,
  resetTime: Date.now() + 60000,
};

describe('Services API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createServerClient as Mock).mockResolvedValue(mockSupabase);
    (rateLimitWriteAsync as Mock).mockResolvedValue(mockRateLimit);
    (apiSuccess as Mock).mockImplementation((data, options) => ({
      data,
      options,
      status: 201,
    }));
    (apiUnauthorized as Mock).mockReturnValue({ error: 'Unauthorized', status: 401 });
    (apiRateLimited as Mock).mockReturnValue({ error: 'Rate limited', status: 429 });
    (handleApiError as Mock).mockImplementation(error => ({
      error: error.message,
      status: 500,
    }));
  });

  it('creates a service successfully for authenticated user', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockServiceData = {
      title: 'Test Service',
      category: 'Consulting',
      fixed_price: 100000,
    };
    const mockCreatedService = {
      id: 'service-123',
      user_id: 'user-123',
      ...mockServiceData,
    };

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Mock service creation
    (createService as Mock).mockResolvedValue(mockCreatedService);

    // Create mock NextRequest with proper json method
    const mockRequest = {
      json: vi.fn().mockResolvedValue(mockServiceData),
      headers: new Headers(),
    } as any;

    const response = await POST(mockRequest);

    expect(createServerClient).toHaveBeenCalled();
    expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    expect(rateLimitWriteAsync).toHaveBeenCalledWith('user-123');
    expect(createService).toHaveBeenCalledWith('user-123', expect.any(Object));
    expect(apiSuccess).toHaveBeenCalledWith(mockCreatedService, { status: 201 });
  });

  it('returns unauthorized for unauthenticated user', async () => {
    // Mock unauthenticated user
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const mockRequest = {
      json: vi.fn().mockResolvedValue({ title: 'Test', category: 'Other', fixed_price: 1000 }),
      headers: new Headers(),
    } as any;

    const response = await POST(mockRequest);

    expect(apiUnauthorized).toHaveBeenCalled();
    expect(createService).not.toHaveBeenCalled();
  });

  it('returns rate limited when user exceeds rate limit', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Mock rate limit exceeded
    (rateLimitWriteAsync as Mock).mockResolvedValue({
      success: false,
      resetTime: Date.now() + 60000, // 1 minute from now
    });

    const mockRequest = {
      json: vi.fn().mockResolvedValue({ title: 'Test', category: 'Other', fixed_price: 1000 }),
      headers: new Headers(),
    } as any;

    const response = await POST(mockRequest);

    expect(rateLimitWriteAsync).toHaveBeenCalledWith('user-123');
    expect(apiRateLimited).toHaveBeenCalledWith(
      'Too many service creation requests. Please slow down.',
      expect.any(Number)
    );
    expect(createService).not.toHaveBeenCalled();
  });

  it('handles service creation errors', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockError = new Error('Database connection failed');
    const serviceData = {
      title: 'Test',
      category: 'Other',
      fixed_price: 1000,
    };

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // Mock service creation error
    (createService as Mock).mockRejectedValue(mockError);

    const mockRequest = {
      json: vi.fn().mockResolvedValue(serviceData),
      headers: new Headers(),
    } as any;

    const response = await POST(mockRequest);

    expect(createService).toHaveBeenCalledWith('user-123', expect.any(Object));
    expect(handleApiError).toHaveBeenCalledWith(mockError);
  });

  it('handles authentication errors', async () => {
    const mockAuthError = new Error('Invalid token');

    // Mock authentication error
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: mockAuthError });

    const mockRequest = {
      json: vi.fn().mockResolvedValue({ title: 'Test', category: 'Other', fixed_price: 1000 }),
      headers: new Headers(),
    } as any;

    const response = await POST(mockRequest);

    expect(apiUnauthorized).toHaveBeenCalled();
    expect(createService).not.toHaveBeenCalled();
  });
});
