import { bearerHeaders } from '@/services/ai/bearer';

describe('bearerHeaders', () => {
  it('sends a bearer when there is a key', () => {
    expect(bearerHeaders('abc')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc',
    });
  });

  it('sends NO Authorization header for an empty key — not "Bearer "', () => {
    const h = bearerHeaders('');
    expect(h).toEqual({ 'Content-Type': 'application/json' });
    expect('Authorization' in h).toBe(false);
  });
});
