/**
 * Production logs at `warn`. A success logged at `info` is therefore dropped,
 * and a monitor that divides wins by losses sees only losses.
 *
 * That is not hypothetical: platform-llm's "model call served" line shipped,
 * passed CI, and was inert in production until someone read the live journal.
 * These tests pin the distinction that fixed it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = process.env.NODE_ENV;

describe('logger.info with always', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env.NODE_ENV = ORIGINAL_ENV;
    vi.resetModules();
  });

  it('is emitted in production, where info is not', async () => {
    const { logger } = await import('@/utils/logger');

    logger.info('dropped at warn threshold', { a: 1 }, 'Test');
    expect(warnSpy).not.toHaveBeenCalled();

    logger.info('a counter a monitor reads', { link: 'groq/x' }, 'Test', { always: true });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('emits the same structured shape, so one parser reads both', async () => {
    const { logger } = await import('@/utils/logger');

    logger.info('model call served', { link: 'groq/openai/gpt-oss-120b' }, 'PlatformLLM', {
      always: true,
    });

    const line = JSON.parse(String(warnSpy.mock.calls[0][0]));
    expect(line).toMatchObject({
      level: 'info',
      message: 'model call served',
      data: { link: 'groq/openai/gpt-oss-120b' },
      source: 'PlatformLLM',
    });
    expect(typeof line.timestamp).toBe('string');
  });
});
