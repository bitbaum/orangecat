/**
 * AUDIT (one-shot): detect entity form fields whose `name` is absent from the
 * entity's Zod validation schema. Zod strips unknown keys by default, so such a
 * field is a silent no-op on submit — the exact class as the loan
 * `show_on_profile` bug (see [[bug_loans_prod_fixes_2026_07_11]]).
 *
 * Prints a full per-entity report. Kept green (informational) so it doubles as a
 * guard: it fails only if a NON-allowlisted field is missing from the schema.
 */
import { getEntityConfig } from '@/config/entity-configs/get-config';
import { ENTITY_TYPES, type EntityType } from '@/config/entity-registry';

// UI-only / meta field names that intentionally do not map to a schema key
// (handled by a custom component, API layer, or purely client-side state).
const ALLOWLIST = new Set<string>([
  '_wallet_id',
  'wallet_id',
  'selectedWalletId',
  'collateral', // array handled via custom component in some configs
  'pricing_model', // service: documented UI-only toggle (hourly vs fixed), never persisted — see commerce.ts UserServiceFormData
]);

/**
 * Unwrap zod v4 wrappers to the inner object. v4 restructured internals:
 * refinements are checks ON a schema (no ZodEffects wrapper), transforms are
 * pipes, and the def lives at `_zod.def` with a lowercase `type` tag.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(schema: any): any {
  let s = schema;
  const seen = new Set();
  while (s && s._zod?.def && !seen.has(s)) {
    seen.add(s);
    const def = s._zod.def;
    if (def.type === 'pipe') s = def.in;
    else if (
      def.type === 'optional' ||
      def.type === 'nullable' ||
      def.type === 'default' ||
      def.type === 'readonly' ||
      def.type === 'catch'
    )
      s = def.innerType;
    else break;
  }
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function schemaInfo(schema: any): { keys: Set<string>; passthrough: boolean } {
  const s = unwrap(schema);
  const def = s?._zod?.def;
  if (!def || def.type !== 'object') {
    return { keys: new Set(), passthrough: false };
  }
  const shape = def.shape ?? {};
  // .passthrough()/.loose() set a non-never catchall in v4.
  const catchallType = def.catchall?._zod?.def?.type;
  const passthrough = catchallType !== undefined && catchallType !== 'never';
  return { keys: new Set(Object.keys(shape)), passthrough };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fieldNames(config: any): string[] {
  const out: string[] = [];
  for (const group of config.fieldGroups ?? []) {
    for (const f of group.fields ?? []) {
      if (f && typeof f.name === 'string') out.push(f.name);
    }
  }
  return out;
}

describe('AUDIT: entity form field ↔ schema drift', () => {
  const offenders: Record<string, string[]> = {};

  it('reports every entity and flags fields missing from the schema', () => {
    const lines: string[] = [];
    for (const type of ENTITY_TYPES as readonly EntityType[]) {
      const config = getEntityConfig(type);
      if (!config) continue;
      const { keys, passthrough } = schemaInfo(config.validationSchema);
      const names = fieldNames(config);
      if (passthrough) {
        lines.push(
          `\n[${type}] schema is .passthrough() — no stripping possible (${names.length} fields)`
        );
        continue;
      }
      const missing = names.filter(n => !keys.has(n));
      const flagged = missing.filter(n => !ALLOWLIST.has(n));
      const allowed = missing.filter(n => ALLOWLIST.has(n));
      lines.push(
        `\n[${type}] ${names.length} form fields, ${keys.size} schema keys` +
          (flagged.length
            ? `\n   ❌ MISSING from schema: ${flagged.join(', ')}`
            : '  ✅ all fields in schema') +
          (allowed.length ? `\n   (allowlisted meta: ${allowed.join(', ')})` : '')
      );
      if (flagged.length) offenders[type] = flagged;
    }
    // eslint-disable-next-line no-console
    console.log('\n===== ENTITY FORM ↔ SCHEMA DRIFT AUDIT =====' + lines.join('') + '\n');

    expect(offenders).toEqual({});
  });
});
