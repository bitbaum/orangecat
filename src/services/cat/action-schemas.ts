/**
 * One registry, two consumers: the model and the executor.
 *
 * ADR-0006 D1/D4. `CAT_ACTIONS` already declares, for every action, a typed
 * `parameters[]` with names, types and required flags. Until now that
 * declaration was used only to render prose into the system prompt — the
 * executor accepted `z.record(z.string(), z.unknown())` and handed model JSON
 * straight to the handler, so a missing required field surfaced as whatever
 * error that particular handler happened to throw.
 *
 * This module makes the declaration load-bearing in both directions:
 *
 *   registry ──▶ JSON Schema  ──▶ the model, as a callable tool
 *            └─▶ Zod schema   ──▶ the executor, as a typed boundary
 *
 * Deriving both from one source is the point. A tool the model can call but
 * the executor rejects, or a parameter the executor demands but the model was
 * never told about, are the two failure modes a hand-written second list
 * guarantees eventually.
 */

import { z } from 'zod';
import { CAT_ACTIONS, type CatAction } from '@/config/cat-actions';

/** The JSON-Schema fragment for one parameter, as providers expect it. */
interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  items?: { type: 'string' };
}

/** OpenAI-style function tool, the shape Groq and OpenRouter both accept. */
export interface ActionToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, JsonSchemaProperty>;
      required: string[];
    };
  };
}

/**
 * Model output is text, so a number often arrives as `"0.001"` and a boolean as
 * `"true"`. Coercing those is not laxness — it is reading the wire format
 * correctly. What is NOT coerced is presence: a missing required parameter
 * stays an error, because inventing one would put a made-up value into a real
 * row.
 */
function zodForParameter(param: CatAction['parameters'][number]): z.ZodTypeAny {
  switch (param.type) {
    case 'number':
      return z.coerce.number();
    case 'btc':
      // BTC is the canonical unit platform-wide and amounts are positive.
      // A negative or zero amount is never a valid instruction.
      return z.coerce.number().positive();
    case 'boolean':
      return z.coerce.boolean();
    case 'array':
      return z.array(z.unknown());
    case 'object':
      // Values stay `unknown`: this is a bag of entity fields whose shape
      // depends on the entity type, and the handler is what knows it.
      return z.record(z.string(), z.unknown());
    case 'entity_id':
    case 'user_id':
      // Deliberately not `.uuid()`: several handlers accept a slug or a
      // username here, and rejecting those at the boundary would break
      // actions that work today.
      return z.string().min(1);
    case 'string':
    default:
      return z.string();
  }
}

function jsonTypeForParameter(param: CatAction['parameters'][number]): JsonSchemaProperty {
  switch (param.type) {
    case 'number':
    case 'btc':
      return { type: 'number', description: param.description };
    case 'boolean':
      return { type: 'boolean', description: param.description };
    case 'array':
      return { type: 'array', description: param.description, items: { type: 'string' } };
    case 'object':
      return { type: 'object', description: param.description };
    default:
      return { type: 'string', description: param.description };
  }
}

/**
 * The Zod schema for one action's parameters.
 *
 * TWO DELIBERATE WEAKNESSES, both forced by measurement rather than chosen:
 *
 * 1. Unknown keys PASS THROUGH; they are neither stripped nor rejected.
 * 2. `required` is NOT enforced — every declared parameter is optional here.
 *
 * The registry is not (yet) a complete contract. Handlers accept aliases it
 * never declares — `price` for the declared `price_btc`, `goal_amount` for
 * `goal_btc`, plus `hourly_rate`, `fixed_price`, `target_amount`,
 * `cause_category`, `label` — and there are tests in
 * `__tests__/unit/cat/action-executor-columns.test.ts` deliberately pinning
 * that behaviour ("falls back to `price` param when no price_btc provided").
 *
 * So a strict schema built from `parameters[]` would strip the alias and then
 * reject the call for missing the canonical name, breaking six actions that
 * work in production today. Enforcing the declaration requires FIRST making
 * the declaration true — declaring every alias each handler accepts — which
 * is a change to the registry, not to this file.
 *
 * What this still buys, and why it is worth shipping ahead of that: model
 * output is text, so `"0.001"` arrives where a number belongs; coercing the
 * parameters the registry DOES declare fixes that for every action at once,
 * and a negative or zero BTC amount stops here instead of reaching a row.
 */
export function schemaForAction(action: CatAction): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const param of action.parameters) {
    const base = zodForParameter(param);
    shape[param.name] =
      param.default !== undefined ? base.optional().default(param.default as never) : base.optional();
  }
  // `.catchall(z.unknown())` is the load-bearing call: it keeps undeclared
  // aliases intact so the handler still sees them. NOT `.passthrough()` —
  // Zod 4 removed that method, and calling it threw inside validation, which
  // the executor caught and reported as a failed action. Every create failed,
  // and the message said nothing about zod.
  return z.object(shape).catchall(z.unknown());
}

export interface ParameterValidation {
  ok: boolean;
  /** Parsed and coerced parameters — only present when ok. */
  data?: Record<string, unknown>;
  /**
   * A sentence the MODEL reads and can act on, not a stack trace. With the
   * in-turn loop (D2) this comes back as a tool result, so the wording is
   * chosen to make the next attempt correct rather than to explain a failure
   * to a developer.
   */
  error?: string;
}

export function validateActionParameters(
  actionId: string,
  parameters: Record<string, unknown>
): ParameterValidation {
  const action = CAT_ACTIONS[actionId];
  if (!action) {
    return { ok: false, error: `Unknown action: ${actionId}` };
  }

  const parsed = schemaForAction(action).safeParse(parameters ?? {});
  if (parsed.success) {
    return { ok: true, data: parsed.data as Record<string, unknown> };
  }

  const problems = parsed.error.issues.map(issue => {
    const field = issue.path.join('.') || '(root)';
    return `${field}: ${issue.message}`;
  });
  // The message names what the registry expects even though presence is not
  // enforced — when the model DID send a declared field with the wrong type,
  // the surrounding shape is what tells it how to fix the call.
  return {
    ok: false,
    error: `Invalid parameters for ${actionId} — ${problems.join('; ')}. Expected: ${
      action.parameters.map(p => `${p.name} (${p.type})`).join(', ') || 'none'
    }.`,
  };
}

/** The tool definition for one action, as the provider expects it. */
export function toolDefinitionForAction(action: CatAction): ActionToolDefinition {
  const properties: Record<string, JsonSchemaProperty> = {};
  for (const param of action.parameters) {
    properties[param.name] = jsonTypeForParameter(param);
  }
  return {
    type: 'function',
    function: {
      // The action id IS the tool name. One identifier end to end means a
      // tool call needs no translation table to become an execution.
      name: action.id,
      description: action.description,
      parameters: {
        type: 'object',
        properties,
        required: action.parameters.filter(p => p.required).map(p => p.name),
      },
    },
  };
}

/**
 * Every enabled action, as callable tools.
 *
 * `allowedActionIds` narrows to what this user may actually do. Offering a
 * tool the permission service will refuse teaches the model to propose things
 * that always fail, and spends a confirmation prompt on the user to say no.
 */
export function actionToolDefinitions(allowedActionIds?: readonly string[]): ActionToolDefinition[] {
  const allow = allowedActionIds ? new Set(allowedActionIds) : null;
  return Object.values(CAT_ACTIONS)
    .filter(action => action.enabled && (!allow || allow.has(action.id)))
    .map(toolDefinitionForAction);
}
