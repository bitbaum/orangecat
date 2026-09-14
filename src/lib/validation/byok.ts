import { z } from 'zod';
import { CUSTOM_PROVIDER_ID, WIRED_PROVIDER_IDS } from '@/data/aiProviders';

/**
 * Body of POST /api/user/api-keys.
 *
 * WIRED_PROVIDER_IDS is the SSOT for providers the chat pipeline can actually
 * route — a previously hardcoded list here accepted providers (anthropic,
 * google) that skipped validation and sat dead in the chain.
 *
 * Two shapes share one schema because they share one table and one chain:
 *   - a VENDOR key: `apiKey` required, `baseUrl` / `defaultModel` ignored
 *     (the vendor's URL is fixed in PROVIDER_BASE_URLS).
 *   - the user's OWN endpoint (CUSTOM_PROVIDER_ID): `baseUrl` required,
 *     `apiKey` optional — vLLM and llama.cpp ship with no auth at all, and
 *     demanding a made-up key would only teach people to paste junk.
 */
export const addKeySchema = z
  .object({
    provider: z.enum(WIRED_PROVIDER_IDS).default('openrouter'),
    keyName: z.string().min(1).max(50).default('Default'),
    apiKey: z.string().max(500).default(''),
    isPrimary: z.boolean().default(true),
    baseUrl: z.string().trim().max(300).optional(),
    defaultModel: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.provider === CUSTOM_PROVIDER_ID) {
      if (!data.baseUrl) {
        ctx.addIssue({
          code: 'custom',
          path: ['baseUrl'],
          message: 'Base URL is required for your own endpoint',
        });
      } else if (!/^https?:\/\//i.test(data.baseUrl)) {
        ctx.addIssue({
          code: 'custom',
          path: ['baseUrl'],
          message: 'Base URL must start with http:// or https://',
        });
      }
      return;
    }
    if (data.apiKey.length < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['apiKey'],
        message: 'API key is too short',
      });
    }
  });

export type AddKeyBody = z.infer<typeof addKeySchema>;
