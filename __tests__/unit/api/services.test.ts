import { createService } from '@/domain/commerce/service';
import { userServiceSchema } from '@/lib/validation';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';

// Mock the Supabase admin client (createService uses createAdminClient, not createServerClient)
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'a1' }),
}));

import { createAdminClient } from '@/lib/supabase/admin';

import type { Mock } from 'vitest';

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

describe('Service Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createAdminClient as Mock).mockReturnValue(mockSupabase);
  });

  describe('userServiceSchema validation', () => {
    it('accepts valid service data', () => {
      const validService = {
        title: 'Car Repair Service',
        description: 'Professional automotive repair services',
        category: 'Automotive',
        fixed_price: 150000,
        currency: PLATFORM_DEFAULT_CURRENCY,
        duration_minutes: 120,
        service_location_type: 'both',
        status: 'draft',
      };

      const result = userServiceSchema.safeParse(validService);
      expect(result.success).toBe(true);
    });

    it('accepts valid service with hourly rate', () => {
      const validService = {
        title: 'Consulting Service',
        category: 'Consulting',
        hourly_rate: 5000,
        currency: PLATFORM_DEFAULT_CURRENCY,
        duration_minutes: 60,
        service_location_type: 'remote',
        status: 'active',
      };

      const result = userServiceSchema.safeParse(validService);
      expect(result.success).toBe(true);
    });

    it('rejects service without pricing', () => {
      const invalidService = {
        title: 'Service Without Price',
        category: 'Other',
        currency: PLATFORM_DEFAULT_CURRENCY,
        service_location_type: 'remote',
        status: 'draft',
      };

      const result = userServiceSchema.safeParse(invalidService);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('At least one pricing method');
    });

    it('rejects service with invalid title', () => {
      const invalidService = {
        title: '', // empty title
        category: 'Other',
        fixed_price_sats: 100000,
        currency: PLATFORM_DEFAULT_CURRENCY,
        service_location_type: 'remote',
        status: 'draft',
      };

      const result = userServiceSchema.safeParse(invalidService);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Title is required');
    });

    it('rejects service with invalid category', () => {
      const invalidService = {
        title: 'Valid Title',
        category: '', // empty category
        fixed_price_sats: 100000,
        currency: PLATFORM_DEFAULT_CURRENCY,
        service_location_type: 'remote',
        status: 'draft',
      };

      const result = userServiceSchema.safeParse(invalidService);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('Category is required');
    });
  });

  describe('createService function', () => {
    const mockUserId = 'test-user-id-123';
    const mockServiceData = {
      title: 'Test Car Repair Service',
      description: 'Professional automotive repair services',
      category: 'Automotive',
      fixed_price: 150000,
      currency: 'SATS' as const,
      duration_minutes: 120,
      service_location_type: 'both' as const,
      images: ['https://example.com/image1.jpg'],
      portfolio_links: ['https://example.com/portfolio'],
    };

    const mockCreatedService = {
      id: 'service-id-123',
      user_id: mockUserId,
      title: 'Test Car Repair Service',
      description: 'Professional automotive repair services',
      category: 'Automotive',
      fixed_price: 150000,
      currency: 'SATS',
      duration_minutes: 120,
      service_location_type: 'both',
      images: ['https://example.com/image1.jpg'],
      portfolio_links: ['https://example.com/portfolio'],
      status: 'draft',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('creates a service successfully', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockCreatedService, error: null });

      const result = await createService(mockUserId, mockServiceData);

      expect(createAdminClient).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalled();
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: mockUserId,
        actor_id: 'a1',
        title: 'Test Car Repair Service',
        description: 'Professional automotive repair services',
        category: 'Automotive',
        hourly_rate: null,
        fixed_price: 150000,
        currency: 'SATS',
        duration_minutes: 120,
        availability_schedule: undefined,
        service_location_type: 'both',
        service_area: null,
        images: ['https://example.com/image1.jpg'],
        portfolio_links: ['https://example.com/portfolio'],
        show_on_profile: true,
        status: 'draft',
      });
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.single).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedService);
    });

    it('creates a service with hourly rate', async () => {
      const hourlyServiceData = {
        title: 'Hourly Consulting',
        category: 'Consulting',
        hourly_rate: 5000,
        currency: PLATFORM_DEFAULT_CURRENCY,
        duration_minutes: 60,
        service_location_type: 'remote',
      };

      mockSupabase.single.mockResolvedValue({
        data: { ...mockCreatedService, ...hourlyServiceData },
        error: null,
      });

      const result = await createService(mockUserId, hourlyServiceData);

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: mockUserId,
        actor_id: 'a1',
        title: 'Hourly Consulting',
        description: null,
        category: 'Consulting',
        hourly_rate: 5000,
        fixed_price: null,
        currency: PLATFORM_DEFAULT_CURRENCY,
        duration_minutes: 60,
        availability_schedule: undefined,
        service_location_type: 'remote',
        service_area: null,
        images: [],
        portfolio_links: [],
        show_on_profile: true,
        status: 'draft',
      });
      expect(result).toBeDefined();
    });

    it('throws error when database operation fails', async () => {
      const mockError = new Error('Database connection failed');
      mockSupabase.single.mockResolvedValue({ data: null, error: mockError });

      await expect(createService(mockUserId, mockServiceData)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('handles empty optional fields correctly', async () => {
      const minimalServiceData = {
        title: 'Minimal Service',
        category: 'Other',
        fixed_price: 100000,
      };

      mockSupabase.single.mockResolvedValue({
        data: { ...mockCreatedService, ...minimalServiceData },
        error: null,
      });

      const result = await createService(mockUserId, minimalServiceData);

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: mockUserId,
        actor_id: 'a1',
        title: 'Minimal Service',
        description: null,
        category: 'Other',
        hourly_rate: null,
        fixed_price: 100000,
        currency: PLATFORM_DEFAULT_CURRENCY,
        duration_minutes: null,
        availability_schedule: undefined,
        service_location_type: 'remote',
        service_area: null,
        images: [],
        portfolio_links: [],
        show_on_profile: true,
        status: 'draft',
      });
      expect(result).toBeDefined();
    });
  });
});
