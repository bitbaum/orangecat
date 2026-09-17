/**
 * The AI form-assist input floor must depend on the intent.
 *
 * Regression guard for a dead end users hit on the Create/Edit forms: the
 * "Adjust" button enabled at 3 characters while the API rejected anything
 * under 10, so the most natural way to ask for a small change — "shorter",
 * "longer", "in german" — failed with "Description must be at least 10
 * characters". Two hardcoded numbers in two files, drifted apart.
 *
 * Both ends now read AI_ASSIST_MIN_INPUT_LENGTH. These tests lock the
 * behaviour that number exists to produce.
 */

import { POST } from '@/app/api/ai/form-prefill/route';
import { generateFormPrefill } from '@/lib/ai/form-prefill-service';
import { AI_ASSIST_MIN_INPUT_LENGTH, AI_ADJUSTMENTS } from '@/config/ai-form-assist';

import type { MockedFunction } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// withAuth wraps the handler in a real Supabase session lookup; the request
// itself is what this suite is about, so authentication is stubbed through.
vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => Promise<unknown>) =>
    (req: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: { id: 'test-user' }, supabase: {} })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn().mockResolvedValue({ success: true }),
  retryAfterSeconds: () => 0,
}));

// The response helpers wrap NextResponse, which needs the Next runtime; the
// established convention in route tests is to stub them.
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({ status: 200, body: { success: true, data } })),
  apiValidationError: vi.fn((error: string) => ({ status: 400, error })),
  apiBadRequest: vi.fn((error: string) => ({ status: 400, error })),
  apiRateLimited: vi.fn(() => ({ status: 429 })),
  apiInternalError: vi.fn(() => ({ status: 500 })),
}));

vi.mock('@/lib/ai/form-prefill-service', () => ({
  generateFormPrefill: vi.fn(),
}));

const mockedPrefill = generateFormPrefill as MockedFunction<typeof generateFormPrefill>;

const BASE = {
  entityType: 'service',
  existingData: { title: 'Photography', description: 'I offer photography.' },
};

/** Call the route the way the browser does, minus the transport. */
function post(body: Record<string, unknown>): Promise<{ status: number }> {
  return (POST as unknown as (req: unknown) => Promise<{ status: number }>)({
    json: async () => body,
  });
}

describe('POST /api/ai/form-prefill — input length depends on intent', () => {
  beforeEach(() => {
    mockedPrefill.mockReset();
    mockedPrefill.mockResolvedValue({
      success: true,
      data: { description: 'A longer, more useful description.' },
      confidence: { description: 0.9 },
      changedFields: ['description'],
    });
  });

  // The exact words that used to fail. All are under the fill floor.
  it.each(['shorter', 'longer', 'in german', 'add tags'])(
    'accepts the short instruction %p when refining',
    async instruction => {
      expect(instruction.length).toBeLessThan(AI_ASSIST_MIN_INPUT_LENGTH.fill);

      const response = await post({ ...BASE, description: instruction, intent: 'refine' });

      expect(response.status).toBe(200);
      expect(mockedPrefill).toHaveBeenCalledWith(
        expect.objectContaining({ description: instruction, intent: 'refine' })
      );
    }
  );

  it('still demands a real description when filling an empty form', async () => {
    const response = await post({ ...BASE, description: 'shorter', intent: 'fill' });

    expect(response.status).toBe(400);
    expect(mockedPrefill).not.toHaveBeenCalled();
  });

  it('defaults to the fill floor when no intent is sent', async () => {
    const response = await post({ ...BASE, description: 'shorter' });

    expect(response.status).toBe(400);
  });

  it('rejects an instruction below the refine floor', async () => {
    const tooShort = 'x'.repeat(AI_ASSIST_MIN_INPUT_LENGTH.refine - 1);

    const response = await post({ ...BASE, description: tooShort, intent: 'refine' });

    expect(response.status).toBe(400);
    expect(mockedPrefill).not.toHaveBeenCalled();
  });

  it('does not count surrounding whitespace towards the floor', async () => {
    const response = await post({ ...BASE, description: '   a   ', intent: 'refine' });

    expect(response.status).toBe(400);
  });

  it('accepts every one-click adjustment instruction', async () => {
    for (const adjustment of AI_ADJUSTMENTS) {
      const response = await post({
        ...BASE,
        description: adjustment.instruction,
        intent: 'refine',
      });
      expect(response.status).toBe(200);
    }
  });
});

describe('AI_ASSIST_MIN_INPUT_LENGTH', () => {
  it('lets a refinement be shorter than a from-scratch description', () => {
    // A refinement is an instruction about a form that is already full; a fill
    // has to carry all the substance itself.
    expect(AI_ASSIST_MIN_INPUT_LENGTH.refine).toBeLessThan(AI_ASSIST_MIN_INPUT_LENGTH.fill);
    expect(AI_ASSIST_MIN_INPUT_LENGTH.refine).toBeGreaterThan(0);
  });
});
