/**
 * auditLog swallows every failure by design — it must never break the operation
 * it records. That makes the client it writes through load-bearing: a write that
 * fails is invisible. These pin that a caller-supplied client is the one used,
 * and that the request session is only the fallback.
 */

import { auditLog, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { createServerClient } from '@/lib/supabase/server';

import type { Mock } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const createServerClientMock = createServerClient as Mock;

function clientRecordingInserts() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return { client: { from: vi.fn(() => ({ insert })) }, insert };
}

beforeEach(() => vi.clearAllMocks());

describe('auditLog', () => {
  it('writes through the client it is given, without touching the request session', async () => {
    const { client, insert } = clientRecordingInserts();
    await auditLog(
      { action: AUDIT_ACTIONS.PAYMENT_SENT, userId: 'u1', entityId: 'h1' },
      client as never
    );

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(client.from).toHaveBeenCalledWith('audit_logs');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_SENT',
        user_id: 'u1',
        entity_id: 'h1',
        success: true,
      })
    );
  });

  it('falls back to the request session when no client is given', async () => {
    const { client, insert } = clientRecordingInserts();
    createServerClientMock.mockResolvedValue(client);
    await auditLog({ action: AUDIT_ACTIONS.WALLET_CREATED, userId: 'u1' });

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicit null as unknown — it must not become "succeeded"', async () => {
    const { client, insert } = clientRecordingInserts();
    await auditLog(
      { action: AUDIT_ACTIONS.PAYMENT_SEND_UNCONFIRMED, userId: 'u1', success: null },
      client as never
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ success: null }));
  });

  it('still records an omitted outcome as a success', async () => {
    const { client, insert } = clientRecordingInserts();
    await auditLog({ action: AUDIT_ACTIONS.WALLET_CREATED, userId: 'u1' }, client as never);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('never throws, even when the write itself blows up', async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error('db gone');
      }),
    };
    await expect(
      auditLog({ action: AUDIT_ACTIONS.PAYMENT_SENT, userId: 'u1' }, client as never)
    ).resolves.toBeUndefined();
  });
});
