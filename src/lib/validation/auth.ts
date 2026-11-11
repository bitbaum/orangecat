import { z } from 'zod';
import { usernameSchema } from './base';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@bitbaum/accountkit/auth/password';

/**
 * The one bitbaum password rule (@bitbaum/accountkit): not empty, at most 128
 * characters. No complexity, no common-password list, no strength meter.
 */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'Password is required')
  .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`);

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    email: z.string().email('Please enter a valid email'),
    // Was a third copy of these rules, capped at 20 while profile edit allowed
    // 30 — so a name you could not register was one you could rename to.
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
