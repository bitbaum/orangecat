/**
 * The registry's parameter declaration becomes load-bearing.
 *
 * ADR-0006 D4. `CAT_ACTIONS` has always declared typed parameters, but nothing
 * enforced them: the API schema was `z.record(z.string(), z.unknown())` and
 * model JSON went straight to the handler, so a missing required field
 * surfaced as whatever that particular handler threw — a different error per
 * action, none of them correctable by the model.
 *
 * These tests pin the two things that must stay true of the generator: that it
 * reads the SAME declaration the prompt is built from, and that it rejects the
 * shapes a model actually gets wrong.
 */

import {
  validateActionParameters,
  toolDefinitionForAction,
  actionToolDefinitions,
  schemaForAction,
} from '@/services/cat/action-schemas';
import { CAT_ACTIONS } from '@/config/cat-actions';

describe('validateActionParameters', () => {
  it('accepts a well-formed call', () => {
    const result = validateActionParameters('create_product', {
      title: 'Ebook',
      price_btc: 0.001,
    });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ title: 'Ebook', price_btc: 0.001 });
  });

  it('does NOT enforce required, because the registry under-declares', () => {
    // Handlers accept aliases the registry never lists — `price` for the
    // declared `price_btc`, `goal_amount` for `goal_btc`, and others, each
    // pinned by a test in action-executor-columns.test.ts. Enforcing presence
    // against an incomplete declaration would reject calls that work in
    // production today. Enforcement is blocked on completing the registry,
    // not on this schema.
    const result = validateActionParameters('create_product', { title: 'Ebook' });
    expect(result.ok).toBe(true);
  });

  it('names the expected shape when a declared field has the wrong type', () => {
    const result = validateActionParameters('create_product', {
      title: 'Ebook',
      price_btc: 'free',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('price_btc');
    expect(result.error).toContain('Expected:');
  });

  it('coerces the string numbers models actually emit', () => {
    // Model output is text. "0.001" is the wire format, not a mistake.
    const result = validateActionParameters('create_product', {
      title: 'Ebook',
      price_btc: '0.001',
    });
    expect(result.ok).toBe(true);
    expect(result.data?.price_btc).toBe(0.001);
  });

  it('refuses a non-positive BTC amount', () => {
    // BTC is the canonical unit and an amount is never zero or negative;
    // letting one through would put it in a real row.
    expect(validateActionParameters('create_product', { title: 'x', price_btc: 0 }).ok).toBe(false);
    expect(validateActionParameters('create_product', { title: 'x', price_btc: -1 }).ok).toBe(false);
  });

  it('passes an undeclared parameter THROUGH to the handler', () => {
    // Not stripped. `price`, `goal_amount`, `cause_category` and friends are
    // undeclared aliases that handlers rely on; stripping them broke six
    // actions the first time this shipped.
    const result = validateActionParameters('create_product', {
      title: 'Ebook',
      price: 0.005,
    });
    expect(result.ok).toBe(true);
    expect(result.data?.price).toBe(0.005);
  });

  it('applies a declared default', () => {
    const result = validateActionParameters('create_product', {
      title: 'Ebook',
      price_btc: 0.001,
    });
    // `publish` declares `default: false` in the registry.
    expect(result.data?.publish).toBe(false);
  });

  it('rejects an action that does not exist', () => {
    expect(validateActionParameters('delete_the_database', {}).ok).toBe(false);
  });

  it('tolerates a call with no parameters object at all', () => {
    // A model omitting `arguments` entirely must produce a typed rejection,
    // not a crash on `undefined`.
    expect(() =>
      validateActionParameters('create_product', undefined as unknown as Record<string, unknown>)
    ).not.toThrow();
  });
});

describe('tool definitions are generated from the registry', () => {
  it('uses the action id as the tool name, so no translation table exists', () => {
    const def = toolDefinitionForAction(CAT_ACTIONS.create_project);
    expect(def.function.name).toBe('create_project');
    expect(def.type).toBe('function');
  });

  it('marks exactly the registry-required parameters as required', () => {
    const action = CAT_ACTIONS.create_product;
    const def = toolDefinitionForAction(action);
    const expected = action.parameters.filter(p => p.required).map(p => p.name);
    expect(def.function.parameters.required).toEqual(expected);
  });

  it('maps btc to a JSON number, not a string', () => {
    const def = toolDefinitionForAction(CAT_ACTIONS.create_product);
    expect(def.function.parameters.properties.price_btc.type).toBe('number');
  });

  it('offers every enabled action when unfiltered', () => {
    const enabled = Object.values(CAT_ACTIONS).filter(a => a.enabled).length;
    expect(actionToolDefinitions()).toHaveLength(enabled);
  });

  it('offers only what the user may actually do', () => {
    // Offering an action the permission service will refuse teaches the model
    // to propose things that always fail.
    const defs = actionToolDefinitions(['create_project']);
    expect(defs.map(d => d.function.name)).toEqual(['create_project']);
  });
});

describe('every action in the registry produces a usable schema', () => {
  it('builds a schema and a tool definition for all of them', () => {
    // A registry entry that cannot be turned into a tool is an action the
    // model can never call — invisible unless something checks all of them.
    for (const action of Object.values(CAT_ACTIONS)) {
      expect(() => schemaForAction(action)).not.toThrow();
      const def = toolDefinitionForAction(action);
      expect(def.function.name).toBe(action.id);
      expect(def.function.description.length).toBeGreaterThan(0);
      for (const param of action.parameters) {
        expect(def.function.parameters.properties[param.name]).toBeDefined();
      }
    }
  });
});
