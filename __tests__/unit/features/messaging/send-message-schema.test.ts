import { describe, expect, it } from 'vitest';
import { MESSAGE_ATTACHMENT_POLICY } from '@/config/message-attachments';
import { sendMessageSchema } from '@/features/messaging/lib/send-message-schema';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('what may be sent as a message', () => {
  it('words alone', () => {
    expect(sendMessageSchema.safeParse({ content: 'hello' }).success).toBe(true);
  });

  it('files alone: a photo needs no caption', () => {
    expect(sendMessageSchema.safeParse({ content: '', attachmentIds: [id(1)] }).success).toBe(true);
  });

  it('neither is not a message — and spaces are not words', () => {
    expect(sendMessageSchema.safeParse({ content: '' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: '   \n ' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: '', attachmentIds: [] }).success).toBe(false);
  });

  it('no more files than one message may carry', () => {
    const tooMany = Array.from({ length: MESSAGE_ATTACHMENT_POLICY.maxPerMessage + 1 }, (_, i) =>
      id(i)
    );
    expect(sendMessageSchema.safeParse({ content: 'x', attachmentIds: tooMany }).success).toBe(
      false
    );
  });

  it('an upload is named by its id, nothing else', () => {
    expect(
      sendMessageSchema.safeParse({ content: 'x', attachmentIds: ['../other/file'] }).success
    ).toBe(false);
  });
});
