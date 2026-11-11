import { loginSchema, registerSchema } from '@/lib/validation/auth';

// The one bitbaum password rule: not empty, at most 128 characters.
const VALID_PASSWORD = 'x';

describe('loginSchema', () => {
  describe('valid inputs', () => {
    it('accepts a proper email and password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'abcdef',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('email validation', () => {
    it('rejects an email missing @', () => {
      const result = loginSchema.safeParse({ email: 'notanemail', password: 'abcdef' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailErrors = result.error.flatten().fieldErrors.email;
        expect(emailErrors).toBeDefined();
        expect(emailErrors![0]).toMatch(/valid email/i);
      }
    });

    it('rejects an empty email', () => {
      const result = loginSchema.safeParse({ email: '', password: 'abcdef' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
      }
    });

    it('rejects an email with no domain', () => {
      const result = loginSchema.safeParse({ email: 'user@', password: 'abcdef' });
      expect(result.success).toBe(false);
    });
  });

  describe('password validation', () => {
    it('rejects an empty password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.password).toBeDefined();
      }
    });
  });
});

describe('registerSchema', () => {
  const validPayload = {
    email: 'alice@orangecat.app',
    username: 'alice_oc',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
  };

  describe('valid inputs', () => {
    it('accepts a fully valid registration', () => {
      const result = registerSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe('email validation', () => {
    it('rejects an invalid email', () => {
      const result = registerSchema.safeParse({ ...validPayload, email: 'bademail' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.email).toBeDefined();
      }
    });
  });

  describe('username validation', () => {
    it('rejects a username shorter than 3 characters', () => {
      const result = registerSchema.safeParse({ ...validPayload, username: 'ab' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const usernameErrors = result.error.flatten().fieldErrors.username;
        expect(usernameErrors).toBeDefined();
        expect(usernameErrors![0]).toMatch(/at least 3 characters/i);
      }
    });

    // Registration used to stop at 20 while profile edit allowed 30, so a
    // 21-character name was unregisterable but reachable by renaming — and 42
    // production usernames (4 of them real accounts) are already longer than 20,
    // which means narrowing profile edit to match would have broken those users'
    // ability to save their own profile. The rules were unified upward at 30.
    it('accepts a 30-character username, the same limit profile edit allows', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        username: 'a'.repeat(30),
      });
      expect(result.success).toBe(true);
    });

    it('rejects a username longer than 30 characters', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        username: 'a'.repeat(31),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const usernameErrors = result.error.flatten().fieldErrors.username;
        expect(usernameErrors).toBeDefined();
        expect(usernameErrors![0]).toMatch(/at most 30 characters/i);
      }
    });

    it('rejects a username with invalid characters', () => {
      const result = registerSchema.safeParse({ ...validPayload, username: 'alice!' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.username).toBeDefined();
      }
    });

    it('accepts usernames with hyphens and underscores', () => {
      const result = registerSchema.safeParse({ ...validPayload, username: 'alice_oc-1' });
      expect(result.success).toBe(true);
    });
  });

  describe('password confirmation', () => {
    it('rejects mismatched passwords', () => {
      const result = registerSchema.safeParse({
        ...validPayload,
        confirmPassword: 'DifferentP@ss1',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const confirmErrors = result.error.flatten().fieldErrors.confirmPassword;
        expect(confirmErrors).toBeDefined();
        expect(confirmErrors![0]).toMatch(/don't match/i);
      }
    });

    it('accepts matching passwords', () => {
      const result = registerSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });
});

describe('the one password rule', () => {
  const base = { email: 'user@example.com', username: 'valid_user', confirmPassword: '' };

  it('refuses an empty password and one longer than 128 characters', () => {
    for (const password of ['', 'x'.repeat(129)]) {
      const result = registerSchema.safeParse({ ...base, password, confirmPassword: password });
      expect(result.success).toBe(false);
    }
  });

  it('accepts any other password, however short and plain', () => {
    for (const password of ['x', 'password', 'x'.repeat(128)]) {
      const result = registerSchema.safeParse({ ...base, password, confirmPassword: password });
      expect(result.success).toBe(true);
    }
  });
});
