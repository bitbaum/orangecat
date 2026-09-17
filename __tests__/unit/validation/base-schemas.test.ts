import {
  lightningAddressSchema,
  optionalUrl,
  isValidLightningAddress,
} from '@/lib/validation/base';

// ---------------------------------------------------------------------------
// isValidLightningAddress helper
// ---------------------------------------------------------------------------
describe('isValidLightningAddress', () => {
  it('returns true for valid addresses', () => {
    expect(isValidLightningAddress('user@domain.com')).toBe(true);
    expect(isValidLightningAddress('alice@orangecat.app')).toBe(true);
    expect(isValidLightningAddress('satoshi@walletofsatoshi.com')).toBe(true);
    expect(isValidLightningAddress('test_user@strike.me')).toBe(true);
    expect(isValidLightningAddress('my-name@ln.tips')).toBe(true);
  });

  it('returns false for invalid addresses', () => {
    expect(isValidLightningAddress('user')).toBe(false);
    expect(isValidLightningAddress('@domain')).toBe(false);
    expect(isValidLightningAddress('')).toBe(false);
    expect(isValidLightningAddress('notanemail')).toBe(false);
    expect(isValidLightningAddress('user@')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lightningAddressSchema (Zod, optional/nullable)
// ---------------------------------------------------------------------------
describe('lightningAddressSchema', () => {
  it('accepts a valid lightning address', () => {
    expect(lightningAddressSchema.safeParse('alice@orangecat.app').success).toBe(true);
    expect(lightningAddressSchema.safeParse('user@domain.com').success).toBe(true);
  });

  it('accepts an empty string (optional)', () => {
    expect(lightningAddressSchema.safeParse('').success).toBe(true);
  });

  it('accepts undefined (optional)', () => {
    expect(lightningAddressSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts null (nullable)', () => {
    expect(lightningAddressSchema.safeParse(null).success).toBe(true);
  });

  it('rejects a plain username with no domain', () => {
    const result = lightningAddressSchema.safeParse('justuser');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(e => e.message);
      expect(messages.some(m => /valid Lightning address/i.test(m))).toBe(true);
    }
  });

  it('rejects "@domain" with no username', () => {
    const result = lightningAddressSchema.safeParse('@domain.com');
    expect(result.success).toBe(false);
  });

  it('rejects a random string', () => {
    const result = lightningAddressSchema.safeParse('not-a-lightning-address');
    expect(result.success).toBe(false);
  });

  it('rejects an address exceeding 200 characters', () => {
    const longAddress = 'a'.repeat(190) + '@domain.com';
    const result = lightningAddressSchema.safeParse(longAddress);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// optionalUrl
// ---------------------------------------------------------------------------
describe('optionalUrl', () => {
  const schema = optionalUrl();

  it('accepts a valid https URL', () => {
    expect(schema.safeParse('https://example.com').success).toBe(true);
  });

  it('accepts a valid http URL', () => {
    expect(schema.safeParse('http://example.com').success).toBe(true);
  });

  it('accepts an empty string (optional)', () => {
    expect(schema.safeParse('').success).toBe(true);
  });

  it('accepts undefined', () => {
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it('accepts null', () => {
    expect(schema.safeParse(null).success).toBe(true);
  });

  it('rejects a non-URL string', () => {
    expect(schema.safeParse('not-a-url').success).toBe(false);
  });

  it('rejects a bare domain without protocol', () => {
    expect(schema.safeParse('example.com').success).toBe(false);
  });
});
