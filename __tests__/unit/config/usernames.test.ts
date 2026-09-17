/**
 * A handle is not just a profile address.
 *
 * `utils/markdown.tsx` already tokenizes `@name` and links it to
 * `/profiles/name`, so whoever holds a handle owns every mention of that name
 * across the platform. `@cat` renders as a link today and nobody owns `cat` —
 * which is why reservation has to exist before the Cat is announced anywhere.
 *
 * These also pin the SSOT itself. The rules used to be written three times with
 * three answers: base.ts allowed 3–30, registerSchema 3–20, profileSchema 3–30.
 * A name you could not register was one you could rename to afterwards.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isReservedUsername,
  reservedReason,
  normalizeUsername,
  isValidUsername,
  USERNAME_MAX_LENGTH,
} from '@/config/usernames';
import { registerSchema } from '@/lib/validation/auth';
import { profileSchema } from '@/lib/validation/base';

describe('reserved handles', () => {
  it('reserves the Cat', () => {
    expect(isReservedUsername('cat')).toBe(true);
    expect(reservedReason('cat')).toMatch(/Cat/);
  });

  it('reserves the spellings a reader would mistake for it', () => {
    // Impersonation only has to fool a human skimming a mention.
    for (const spelling of ['Cat', 'CAT', 'c-a-t', 'c.a.t', 'C_A_T', ' cat ']) {
      expect(isReservedUsername(spelling)).toBe(true);
    }
  });

  it('does not reserve ordinary words that merely contain one', () => {
    // Matching is exact after normalizing, not substring.
    for (const ok of ['category', 'catalog', 'cathy', 'concatenate', 'bobcat']) {
      expect(isReservedUsername(ok)).toBe(false);
    }
  });

  it('reserves the identities used to impersonate the platform', () => {
    for (const name of ['admin', 'support', 'security', 'billing', 'system']) {
      expect(isReservedUsername(name)).toBe(true);
    }
  });

  it('normalizes to the form two handles are compared in', () => {
    expect(normalizeUsername('My-Cat_')).toBe('mycat');
  });
});

describe('one set of username rules', () => {
  const base = {
    email: 'a@b.com',
    password: 'Str0ng!passw0rd',
    confirmPassword: 'Str0ng!passw0rd',
  };

  it('registration refuses a reserved handle', () => {
    const result = registerSchema.safeParse({ ...base, username: 'cat' });
    expect(result.success).toBe(false);
  });

  it('profile edit refuses it too — reservation cannot be sidestepped by renaming', () => {
    const result = profileSchema.safeParse({ username: 'cat' });
    expect(result.success).toBe(false);
  });

  it('registration and profile edit agree on length', () => {
    const long = 'a'.repeat(USERNAME_MAX_LENGTH);
    const tooLong = 'a'.repeat(USERNAME_MAX_LENGTH + 1);

    // Registration used to cap at 20, so this 30-character name was registerable
    // only by editing a profile afterwards.
    expect(registerSchema.safeParse({ ...base, username: long }).success).toBe(true);
    expect(profileSchema.safeParse({ username: long }).success).toBe(true);

    expect(registerSchema.safeParse({ ...base, username: tooLong }).success).toBe(false);
    expect(profileSchema.safeParse({ username: tooLong }).success).toBe(false);
  });

  it('still accepts an ordinary handle', () => {
    expect(isValidUsername('satoshi_n')).toBe(true);
    expect(registerSchema.safeParse({ ...base, username: 'satoshi_n' }).success).toBe(true);
  });
});

/**
 * The third door.
 *
 * A profile claim (`/dashboard/profile-claims/new` → `/claim/<id>`) lets a
 * member draft a handle for someone who has no account yet; the recipient's
 * `profiles.username` is written from that draft at claim time. The path
 * validated `suggestedUsername` with its own local regex and allocated it with
 * a collision probe that consulted neither `RESERVED_USERNAMES` nor the
 * case-insensitive unique index — so it was the one way to mint `payments`,
 * `support` or `security` as a handle, and a handle is a Lightning address
 * (`<username>@orangecat.ch`). Measured against production 2026-09-05: 14 of
 * the 15 reserved handles were free.
 *
 * Source-level because neither the route's zod schema nor
 * `findAvailableUsername` is exported — and the thing being prevented is
 * precisely "someone writes a second set of username rules here again".
 */
describe('profile claims ask the same SSOT', () => {
  const claimsRoute = readFileSync(
    join(process.cwd(), 'src/app/api/profile-claims/route.ts'),
    'utf8'
  );
  const claimsService = readFileSync(
    join(process.cwd(), 'src/domain/profileClaims/service.ts'),
    'utf8'
  );

  it('validates a suggested handle with the shared schema, not a local pattern', () => {
    expect(claimsRoute).toMatch(/suggestedUsername:\s*usernameSchema/);
    expect(claimsRoute).toMatch(/usernameSchema[\s\S]*from '@\/lib\/validation\/base'/);
  });

  it('declares no username pattern of its own', () => {
    // The shape that caused this: an inline `.regex(/^[a-zA-Z0-9_-]+$/, …)`.
    expect(claimsRoute).not.toMatch(/a-zA-Z0-9_-/);
  });

  // These match the CALL, not the identifier. Asserting `/reservedReason/`
  // alone passed against a mutant with the guard deleted, because the comment
  // above the guard still named it — a source scan that a comment can satisfy
  // is not a gate.
  it('re-checks reservation when it allocates the handle at claim time', () => {
    // A draft written before the route was fixed can still carry a reserved
    // name, and the `-2` suffixes are built inside the allocator rather than
    // validated upstream.
    expect(claimsService).toMatch(/if \(reservedReason\(/);
  });

  it('probes for collisions case-insensitively, like the unique index', () => {
    // `profiles_username_lower_unique` is on the generated `username_lower`
    // column. Probing `username` with `.eq` read a case-variant as free and
    // then failed the insert — after the claim had already been flipped to
    // `claimed`, landing in the rollback path.
    expect(claimsService).toMatch(/\.eq\('username_lower',/);
    expect(claimsService).not.toMatch(/\.eq\('username',/);
  });
});
