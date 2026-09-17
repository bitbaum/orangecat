/**
 * Registers every /api/v1/<entity> POST endpoint with the OpenAPI registry.
 *
 * The v1 contract enumerated in src/config/public-api.ts is the SSOT for
 * which routes are exposed; this file maps each public entity type to
 * its existing Zod schema and builds the request/response operation.
 *
 * To add a new entity to v1: add it to PUBLIC_API_ENTITY_TYPES, point
 * to its schema in ENTITY_SCHEMAS below, and the spec picks it up
 * automatically.
 *
 * Created: 2026-06-03
 */

import { z } from 'zod';
import { openApiRegistry } from './registry';
import { apiSuccessSchema, apiErrorSchema } from './responses';
import {
  PUBLIC_API_BASE,
  PUBLIC_API_ENTITY_TYPES,
  type PublicApiEntityType,
  publicApiEndpoint,
} from '@/config/public-api';
import { getEntityMetadata } from '@/config/entity-registry';
import { externalPublishSchema } from '@/config/external-publish';
import { createStakeholderSchema } from '@/config/stakeholders';
import {
  userProductSchema,
  userServiceSchema,
  userCauseSchema,
  projectSchema,
  eventSchema,
  loanSchema,
  investmentSchema,
  assetSchema,
  wishlistSchema,
} from '@/lib/validation';
import { paymentCreateSchema, publicSupportCreateSchema } from '@/lib/validation/finance';

/**
 * Map public entity types to their request-body Zod schemas. Adding a
 * new entity to v1 means adding it here AND to PUBLIC_API_ENTITY_TYPES.
 */
const ENTITY_SCHEMAS: Record<PublicApiEntityType, z.ZodTypeAny> = {
  product: userProductSchema,
  service: userServiceSchema,
  project: projectSchema,
  cause: userCauseSchema,
  event: eventSchema,
  loan: loanSchema,
  investment: investmentSchema,
  asset: assetSchema,
  wishlist: wishlistSchema,
};

/**
 * Every endpoint accepts the optional `actor_id` field to create on
 * behalf of a group actor. The integration-key auth path ignores body
 * `actor_id` because the key itself is bound to one. Either way the
 * field is part of the contract.
 */
const ACTOR_ID_FIELD = {
  actor_id: z.string().guid().optional().openapi({
    description:
      'Optional actor to create on behalf of. Session auth: user must be a privileged member (founder/admin/moderator) of the group whose actor matches. Integration-key auth: the key is already bound to an actor; this field is ignored.',
  }),
};

/**
 * Response payload for a successful create — same fields as the request
 * body plus a server-assigned `id`. We do not attempt to model every
 * DB-side default; consumers should treat unknown fields as additive.
 */
function buildEntityResponseSchema(requestSchema: z.ZodTypeAny, label: string) {
  const requestObject =
    requestSchema instanceof z.ZodObject ? requestSchema : z.object({}).catchall(z.unknown());

  return requestObject
    .extend({
      id: z.string().guid().openapi({ description: 'Server-assigned identifier.' }),
      actor_id: z.string().guid().openapi({ description: 'Actor that owns the created entity.' }),
      created_at: z.string().datetime().openapi({ description: 'ISO 8601 creation timestamp.' }),
    })
    .passthrough()
    .openapi(`${label}Response`);
}

const COMMON_ERROR_RESPONSES = {
  400: {
    description: 'Validation error — request body did not match the schema.',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  401: {
    description: 'Missing or invalid authentication.',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  403: {
    description:
      'Authenticated, but not permitted to act as the requested actor (session auth only).',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  404: {
    description:
      'Resource does not exist OR exists but is not visible to the caller (same envelope so probers cannot distinguish).',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  429: {
    description: 'Rate limit exceeded for this user / key.',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
  500: {
    description: 'Internal server error.',
    content: { 'application/json': { schema: apiErrorSchema } },
  },
} as const;

/**
 * Register every v1 entity route with the shared OpenAPI registry. Safe
 * to call more than once — the registry deduplicates on path+method.
 */
export function registerV1Routes(): void {
  // Auth scheme — applies to every protected route.
  openApiRegistry.registerComponent('securitySchemes', 'IntegrationKey', {
    type: 'apiKey',
    in: 'header',
    name: 'X-OrangeCat-Key',
    description:
      'Integration key minted at /settings/integrations. Format: `ock_<48-hex>`. Also accepted via standard `Authorization: Bearer ock_<48-hex>`. The key is bound to a single actor at mint time — every authenticated request acts as that actor.',
  });

  // Discovery endpoint — public, unauth'd.
  openApiRegistry.registerPath({
    method: 'get',
    path: PUBLIC_API_BASE,
    summary: 'API discovery',
    description:
      "Returns the contract version, base path, auth header hint, and every endpoint we promise to keep working under v1. SDKs should hit this once at startup to confirm they're talking to a server that speaks v1.",
    tags: ['Discovery'],
    responses: {
      200: {
        description: 'Discovery payload.',
        content: { 'application/json': { schema: z.unknown() } },
      },
    },
  });

  // Entity create + list endpoints.
  for (const entityType of PUBLIC_API_ENTITY_TYPES) {
    const schema = ENTITY_SCHEMAS[entityType];
    const meta = getEntityMetadata(entityType);
    const label = meta.name.replace(/\s+/g, '');

    const requestSchema =
      schema instanceof z.ZodObject
        ? schema.extend(ACTOR_ID_FIELD).openapi(`${label}Create`)
        : schema;

    const responseSchema = buildEntityResponseSchema(schema, label);

    openApiRegistry.registerPath({
      method: 'post',
      path: publicApiEndpoint(entityType),
      summary: `Create ${meta.name.toLowerCase()}`,
      description: meta.description,
      tags: [meta.name],
      security: [{ IntegrationKey: [] }],
      request: {
        body: {
          required: true,
          content: { 'application/json': { schema: requestSchema } },
        },
      },
      responses: {
        201: {
          description: `${meta.name} created successfully.`,
          content: {
            'application/json': {
              schema: apiSuccessSchema(responseSchema, `${label}CreateResponse`),
            },
          },
        },
        ...COMMON_ERROR_RESPONSES,
      },
    });

    openApiRegistry.registerPath({
      method: 'get',
      path: publicApiEndpoint(entityType),
      summary: `List ${meta.namePlural.toLowerCase()}`,
      description: `${meta.description} — integration-key auth returns rows owned by the key's bound actor; session auth returns the caller's rows.`,
      tags: [meta.name],
      security: [{ IntegrationKey: [] }],
      request: {
        query: z
          .object({
            limit: z.coerce
              .number()
              .int()
              .min(1)
              .max(100)
              .optional()
              .openapi({ description: 'Max rows to return. Default 20, max 100.' }),
            offset: z.coerce
              .number()
              .int()
              .min(0)
              .optional()
              .openapi({ description: 'Number of rows to skip.' }),
            category: z.string().optional().openapi({ description: 'Optional category filter.' }),
          })
          .openapi(`${label}ListQuery`),
      },
      responses: {
        200: {
          description: `Paginated list of ${meta.namePlural.toLowerCase()}.`,
          content: {
            'application/json': {
              schema: apiSuccessSchema(z.array(responseSchema), `${label}ListResponse`),
            },
          },
        },
        401: COMMON_ERROR_RESPONSES[401],
        429: COMMON_ERROR_RESPONSES[429],
        500: COMMON_ERROR_RESPONSES[500],
      },
    });

    openApiRegistry.registerPath({
      method: 'get',
      path: `${publicApiEndpoint(entityType)}/{id}`,
      summary: `Get ${meta.name.toLowerCase()} by id`,
      description: `Single ${meta.name.toLowerCase()} read. Integration-key auth scopes to the key's bound actor + is_test flag; session auth returns the caller's rows + public ones; anonymous returns public rows only. Returns 404 — never 403 — when the row exists but isn't visible to the caller.`,
      tags: [meta.name],
      security: [{ IntegrationKey: [] }],
      request: {
        params: z
          .object({
            id: z
              .string()
              .guid()
              .openapi({ description: `${meta.name} id (uuid).` }),
          })
          .openapi(`${label}GetParams`),
      },
      responses: {
        200: {
          description: `The ${meta.name.toLowerCase()}.`,
          content: {
            'application/json': {
              schema: apiSuccessSchema(responseSchema, `${label}GetResponse`),
            },
          },
        },
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        429: COMMON_ERROR_RESPONSES[429],
        500: COMMON_ERROR_RESPONSES[500],
      },
    });
  }

  // Payments — the machine-payable loop: discover (entity GET / search) →
  // pay (POST /payments) → verify (GET /payments/{id} until status=paid).
  const paymentIntentSchema = z
    .object({
      id: z.string().guid(),
      status: z
        .enum([
          'created',
          'invoice_ready',
          'paid',
          'expired',
          'failed',
          'buyer_confirmed',
          'pending_confirmation',
        ])
        .openapi({
          description:
            '`paid` is settlement — detected automatically via NWC lookup or LNURL verify. `buyer_confirmed` is an unverified manual claim awaiting recipient confirmation.',
        }),
      amount_btc: z.number().openapi({ description: 'Amount in BTC (decimal).' }),
      bolt11: z.string().nullable().openapi({ description: 'Lightning invoice to pay.' }),
      onchain_address: z.string().nullable(),
      expires_at: z.string().datetime().nullable(),
    })
    .catchall(z.unknown())
    .openapi('PaymentIntent');

  const paymentCreateResponseSchema = z
    .object({
      payment_intent: paymentIntentSchema,
      qr_data: z.string().openapi({ description: 'String to render as a payment QR code.' }),
      method_label: z.string(),
      expires_in_seconds: z.number().nullable(),
    })
    .catchall(z.unknown())
    .openapi('PaymentCreateResponse');

  openApiRegistry.registerPath({
    method: 'post',
    path: `${PUBLIC_API_BASE}/payments`,
    summary: 'Initiate a payment for an entity',
    description:
      'Creates a payment intent and a Lightning invoice (or on-chain address) for a publicly visible entity — a fixed-price purchase creates an order, a contribution supports a project/cause. Requires the `payments.write` scope. Poll GET /api/v1/payments/{id} until `status` is `paid`. Account-less callers should use POST /api/v1/payments/public instead.',
    tags: ['Payments'],
    security: [{ IntegrationKey: [] }],
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: paymentCreateSchema.openapi('PaymentCreate') } },
      },
    },
    responses: {
      201: {
        description: 'Payment intent created; pay the returned invoice.',
        content: {
          'application/json': {
            schema: apiSuccessSchema(paymentCreateResponseSchema, 'PaymentCreateSuccess'),
          },
        },
      },
      ...COMMON_ERROR_RESPONSES,
    },
  });

  openApiRegistry.registerPath({
    method: 'get',
    path: `${PUBLIC_API_BASE}/payments/{id}`,
    summary: 'Check payment status (settlement verification)',
    description:
      'Returns the live status of a payment intent — NWC lookup / LNURL verify runs on read, so `paid` here means settled, not claimed. Only the buyer or seller can read an intent. Requires the `payments.read` scope.',
    tags: ['Payments'],
    security: [{ IntegrationKey: [] }],
    request: {
      params: z.object({ id: z.string().guid().openapi({ description: 'Payment intent id.' }) }),
    },
    responses: {
      200: {
        description: 'Current payment status.',
        content: {
          'application/json': {
            schema: apiSuccessSchema(paymentIntentSchema, 'PaymentStatusSuccess'),
          },
        },
      },
      401: COMMON_ERROR_RESPONSES[401],
      403: COMMON_ERROR_RESPONSES[403],
      404: COMMON_ERROR_RESPONSES[404],
      429: COMMON_ERROR_RESPONSES[429],
      500: COMMON_ERROR_RESPONSES[500],
    },
  });

  openApiRegistry.registerPath({
    method: 'post',
    path: `${PUBLIC_API_BASE}/payments/public`,
    summary: 'Initiate an account-less payment',
    description:
      'Anonymous support flow: no auth required. Returns the invoice plus a bearer `status_token`; poll GET /api/v1/payments/public/{id} with the `X-Payment-Token` header to verify settlement. Rate limited per IP.',
    tags: ['Payments'],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: publicSupportCreateSchema.openapi('PublicPaymentCreate'),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Payment intent created; pay the invoice, keep the status token.',
        content: {
          'application/json': {
            schema: apiSuccessSchema(
              paymentCreateResponseSchema
                .extend({
                  status_token: z.string().openapi({
                    description:
                      'Bearer token for status polling — the only credential for this intent. Not recoverable if lost.',
                  }),
                })
                .openapi('PublicPaymentCreateResponse'),
              'PublicPaymentCreateSuccess'
            ),
          },
        },
      },
      400: COMMON_ERROR_RESPONSES[400],
      404: COMMON_ERROR_RESPONSES[404],
      429: COMMON_ERROR_RESPONSES[429],
      500: COMMON_ERROR_RESPONSES[500],
    },
  });

  // HTTP 402 inline payment (L402-style) — the standards-shaped face of the
  // machine-payable flow. One GET does both halves: challenge (no auth → 402
  // with WWW-Authenticate: L402 token + invoice) and verify (Authorization:
  // L402 <token>:<preimage> → 200 receipt, preimage checked against the
  // invoice's payment_hash).
  openApiRegistry.registerPath({
    method: 'get',
    path: `${PUBLIC_API_BASE}/pay/{entity_type}/{entity_id}`,
    summary: 'Pay inline via HTTP 402 (L402-style)',
    description:
      'No account, no API key. GET with `?amount_btc=` returns **402 Payment Required** with a `WWW-Authenticate: L402 token="…", invoice="…"` challenge (Lightning bolt11). Pay it, then repeat the GET with `Authorization: L402 <token>:<preimage>` for a 200 receipt — the preimage is verified cryptographically against the invoice payment_hash (settlement status is the fallback for on-chain). Challenge creation is rate limited per IP.',
    tags: ['Payments'],
    request: {
      params: z.object({
        entity_type: z
          .string()
          .openapi({ description: 'Entity type (product, project, cause, …).' }),
        entity_id: z.string().guid(),
      }),
      query: z.object({
        amount_btc: z.coerce.number().openapi({
          description: 'Amount in BTC (0.000001–1). Required on the challenge request.',
        }),
      }),
    },
    responses: {
      200: {
        description: 'Payment verified — the receipt.',
        content: {
          'application/json': {
            schema: apiSuccessSchema(
              z
                .object({
                  status: z.string(),
                  paid_at: z.string().datetime().nullable(),
                  verified_by: z.enum(['preimage', 'settlement']),
                  entity_type: z.string(),
                  entity_id: z.string().guid(),
                })
                .openapi('L402Receipt'),
              'L402ReceiptSuccess'
            ),
          },
        },
      },
      402: {
        description:
          'Payment required. `WWW-Authenticate` carries the L402 challenge; the body repeats the token, bolt11 invoice, amount, and expiry.',
        content: {
          'application/json': {
            schema: z
              .object({
                success: z.literal(false),
                error: z.object({
                  code: z.literal('PAYMENT_REQUIRED'),
                  message: z.string(),
                  details: z
                    .object({
                      payment_intent_id: z.string().guid(),
                      token: z.string(),
                      bolt11: z.string().nullable(),
                      onchain_address: z.string().nullable(),
                      amount_btc: z.number(),
                      method_label: z.string(),
                      expires_in_seconds: z.number().nullable(),
                    })
                    .partial()
                    .openapi({
                      description:
                        'The challenge. On a not-paid-yet retry only `status` is present (the original challenge still stands).',
                    }),
                }),
              })
              .openapi('L402Challenge'),
          },
        },
      },
      400: COMMON_ERROR_RESPONSES[400],
      404: COMMON_ERROR_RESPONSES[404],
      429: COMMON_ERROR_RESPONSES[429],
      500: COMMON_ERROR_RESPONSES[500],
    },
  });

  // Publish bus — not an entity create, so registered explicitly. External
  // clients (Loki) land a build event on a project's wall; idempotent +
  // reconcilable by (source, external_id).
  const publishResponseSchema = z
    .object({
      id: z.string().guid().openapi({ description: 'OrangeCat timeline event id.' }),
      status: z.enum(['created', 'updated']).openapi({
        description: '`created` on first publish, `updated` on a reconciling re-publish.',
      }),
    })
    .openapi('TimelinePublishResponse');

  openApiRegistry.registerPath({
    method: 'post',
    path: `${PUBLIC_API_BASE}/timeline/publish`,
    summary: 'Publish an external build event to a project wall',
    description:
      "Async publish bus: an external client (e.g. Loki) lands a publish-worthy build event onto a project's OrangeCat wall. Requires the `timeline.write` scope and ownership of the subject project. Idempotent + reconcilable — keyed by (source, external_id), so a retry or an edit updates the same event rather than duplicating it.",
    tags: ['Timeline'],
    security: [{ IntegrationKey: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': { schema: externalPublishSchema.openapi('TimelinePublish') },
        },
      },
    },
    responses: {
      201: {
        description: 'Event published for the first time.',
        content: {
          'application/json': {
            schema: apiSuccessSchema(publishResponseSchema, 'TimelinePublishCreatedResponse'),
          },
        },
      },
      200: {
        description: 'Event reconciled (a prior publish of the same source event was updated).',
        content: {
          'application/json': {
            schema: apiSuccessSchema(publishResponseSchema, 'TimelinePublishUpdatedResponse'),
          },
        },
      },
      401: COMMON_ERROR_RESPONSES[401],
      403: COMMON_ERROR_RESPONSES[403],
      404: COMMON_ERROR_RESPONSES[404],
      422: {
        description: 'Validation error — body did not match the schema, or url origin not allowed.',
        content: { 'application/json': { schema: apiErrorSchema } },
      },
      429: COMMON_ERROR_RESPONSES[429],
      500: COMMON_ERROR_RESPONSES[500],
    },
  });

  const stakeholderRowSchema = z
    .object({
      id: z.string().guid(),
      from_project_id: z.string().guid(),
      kind: z.string(),
      owner_actor_id: z.string().guid(),
    })
    .catchall(z.unknown())
    .openapi('StakeholderRelationship');

  const stakeholderListSchema = z
    .object({
      relationships: z.array(stakeholderRowSchema),
    })
    .openapi('StakeholderListResponse');

  const stakeholderCreateSchema = z
    .object({
      relationship: stakeholderRowSchema,
    })
    .openapi('StakeholderCreateResponse');

  openApiRegistry.registerPath({
    method: 'get',
    path: `${PUBLIC_API_BASE}/stakeholders`,
    summary: 'List stakeholder relationships for a project',
    description:
      'Returns typed edges from a project to competitors, collaborators, investors, and other stakeholder categories. Requires `stakeholders.read` and ownership of the project.',
    tags: ['Stakeholders'],
    security: [{ IntegrationKey: [] }],
    request: {
      query: z.object({
        fromProjectId: z.string().guid().openapi({ description: 'Project whose edges to list.' }),
        kind: z.string().optional().openapi({ description: 'Optional kind filter.' }),
      }),
    },
    responses: {
      200: {
        description: 'Relationships for the project.',
        content: {
          'application/json': {
            schema: apiSuccessSchema(stakeholderListSchema, 'StakeholderListSuccess'),
          },
        },
      },
      401: COMMON_ERROR_RESPONSES[401],
      403: COMMON_ERROR_RESPONSES[403],
      404: COMMON_ERROR_RESPONSES[404],
      422: {
        description: 'Validation error — invalid kind filter.',
        content: { 'application/json': { schema: apiErrorSchema } },
      },
      429: COMMON_ERROR_RESPONSES[429],
      500: COMMON_ERROR_RESPONSES[500],
    },
  });

  openApiRegistry.registerPath({
    method: 'post',
    path: `${PUBLIC_API_BASE}/stakeholders`,
    summary: 'Create a stakeholder relationship',
    description:
      'Adds a typed edge from a project to an actor, another project, or an external URL. Requires `stakeholders.write` and ownership of the source project.',
    tags: ['Stakeholders'],
    security: [{ IntegrationKey: [] }],
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: createStakeholderSchema.openapi('StakeholderCreate'),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Relationship created.',
        content: {
          'application/json': {
            schema: apiSuccessSchema(stakeholderCreateSchema, 'StakeholderCreateSuccess'),
          },
        },
      },
      401: COMMON_ERROR_RESPONSES[401],
      403: COMMON_ERROR_RESPONSES[403],
      404: COMMON_ERROR_RESPONSES[404],
      422: {
        description: 'Validation error — body did not match the schema.',
        content: { 'application/json': { schema: apiErrorSchema } },
      },
      429: COMMON_ERROR_RESPONSES[429],
      500: COMMON_ERROR_RESPONSES[500],
    },
  });
}
