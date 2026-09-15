import { describe, it, expect } from 'vitest';
import { sanitizeApiKey, sanitizeApiKeyChecked } from '@/lib/api-key';

/**
 * This helper stands between a pasted credential and an Authorization header.
 * It used to exist as five copies; these cases pin the one that is left.
 */
describe('sanitizeApiKey', () => {
  it('leaves a clean key untouched', () => {
    expect(sanitizeApiKey('gsk_abc123DEF-_.')).toBe('gsk_abc123DEF-_.');
  });

  it('strips the trailing newline a shell export leaves behind', () => {
    expect(sanitizeApiKey('sk-live-1234\n')).toBe('sk-live-1234');
    expect(sanitizeApiKey('\r\nsk-live-1234\r\n')).toBe('sk-live-1234');
  });

  it('strips spaces and tabs anywhere in the key', () => {
    expect(sanitizeApiKey('  sk-live\t1234 ')).toBe('sk-live1234');
  });

  it('strips control characters and DEL, which Headers.append rejects', () => {
    expect(sanitizeApiKey('sk\u0000-live\u001f-1234\u007f')).toBe('sk-live-1234');
  });

  it('is a no-op on the empty string', () => {
    expect(sanitizeApiKey('')).toBe('');
  });

  it('does not touch non-ASCII bytes — a key is returned, never silently emptied', () => {
    expect(sanitizeApiKey('sk-café')).toBe('sk-café');
  });
});

describe('sanitizeApiKeyChecked', () => {
  it('reports no junk for a clean key', () => {
    expect(sanitizeApiKeyChecked('sk-live-1234')).toEqual({
      clean: 'sk-live-1234',
      hadJunk: false,
    });
  });

  it('reports junk when something had to be removed', () => {
    expect(sanitizeApiKeyChecked('sk-live-1234\n')).toEqual({
      clean: 'sk-live-1234',
      hadJunk: true,
    });
  });
});
