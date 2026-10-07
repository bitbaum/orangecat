/**
 * "Fill with AI" runs on the fleet's form filler, not a copy of it.
 *
 * OrangeCat hand-rolled what Loki takes from `ai-forms` — describing fields,
 * coercing the reply, deciding who wins on conflict, the input floors — and
 * the copies drifted (the merge once let existing values beat every
 * refinement). These pin the one translation that remains: a create-form
 * `FieldConfig` into the package's `FieldSpec`, and the two rules OrangeCat
 * keeps on top of the package's sanitizer.
 */
import { MIN_INSTRUCTION_LENGTH, describeFields, mergeValues } from '@bitbaum/ai-kit/forms';
import { AI_ASSIST_MIN_INPUT_LENGTH, USER_OVERRIDABLE_FIELDS } from '@/config/ai-form-assist';
import { toFieldSpec, toFieldSpecs } from '@/lib/ai/field-spec';
import { mergePrefillResult } from '@/lib/ai/form-prefill-service';
import { parseAIResponse } from '@/lib/ai/prompts/form-prefill';
import { sanitizeAiFields } from '@/lib/ai/sanitize-ai-fields';
import type { FieldConfig } from '@/components/create/types';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('FieldConfig → FieldSpec', () => {
  it('a wall-clock datetime is text to the package, so 19:00 survives the round trip', () => {
    const field: FieldConfig = { name: 'start_date', label: 'Start', type: 'datetime' };
    expect(toFieldSpec(field).type).toBe('text');
    expect(sanitizeAiFields({ start_date: '2026-10-07T19:00' }, [field])).toEqual({
      start_date: '2026-10-07T19:00',
    });
    expect(describeFields(toFieldSpecs([field]))).toContain('YYYY-MM-DDTHH:mm');
  });

  it("a picture is never the model's to write", () => {
    const spec = toFieldSpec({ name: 'image_url', label: 'Photo', type: 'image' });
    expect(spec.aiExcluded).toBe(true);
    expect(
      describeFields(toFieldSpecs([{ name: 'image_url', label: 'Photo', type: 'image' }]))
    ).toContain('image_url');
  });

  it('price and currency are overridable defaults — the same list the merge reads', () => {
    for (const name of USER_OVERRIDABLE_FIELDS) {
      expect(toFieldSpec({ name, label: name, type: 'text' }).overridable).toBe(true);
    }
    expect(toFieldSpec({ name: 'title', label: 'Title', type: 'text' }).overridable).toBe(false);
  });

  it('a currency field is a number with its unit explained; a radio is a select', () => {
    const price = toFieldSpec({
      name: 'price',
      label: 'Price',
      type: 'currency',
      hint: 'Per hour',
    });
    expect(price.type).toBe('number');
    expect(price.hint).toContain('Per hour');
    expect(price.hint).toContain('currency');
    expect(
      toFieldSpec({
        name: 'kind',
        label: 'Kind',
        type: 'radio',
        options: [{ value: 'a', label: 'A' }],
      })
    ).toMatchObject({ type: 'select', options: [{ value: 'a', label: 'A' }] });
  });
});

describe('what OrangeCat keeps on top of the package sanitizer', () => {
  const fields: FieldConfig[] = [
    { name: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 480 },
    { name: 'note', label: 'Note', type: 'text' },
  ];

  it('an out-of-range number is dropped, not clamped to a number nobody said', () => {
    expect(sanitizeAiFields({ minutes: 9999 }, fields)).toEqual({});
    expect(sanitizeAiFields({ minutes: '0' }, fields)).toEqual({});
    expect(sanitizeAiFields({ minutes: 45 }, fields)).toEqual({ minutes: 45 });
  });

  it('null clears a declared field; an undeclared companion passes through', () => {
    expect(sanitizeAiFields({ note: null, currency: 'CHF' }, fields)).toEqual({
      note: null,
      currency: 'CHF',
    });
  });
});

describe('one rule for who wins, one floor for how short', () => {
  it('mergePrefillResult is the package merge with the overridable list applied', () => {
    const ai = { title: 'AI', price: 150, currency: 'CHF' };
    const existing = { title: 'Mine', price: 0, currency: 'USD' };
    const ours = mergePrefillResult(ai, existing, 'fill');
    const theirs = mergeValues(
      ai,
      existing,
      'fill',
      USER_OVERRIDABLE_FIELDS.map(name => ({
        name,
        label: name,
        type: 'text' as const,
        overridable: true,
      }))
    );
    expect(ours).toEqual({ data: theirs.values, changedFields: theirs.changed });
    expect(ours.data).toEqual({ title: 'Mine', price: 150, currency: 'CHF' });
  });

  it("the input floors are the fleet's", () => {
    expect(AI_ASSIST_MIN_INPUT_LENGTH).toBe(MIN_INSTRUCTION_LENGTH);
  });
});

describe('parseAIResponse finds the JSON the fleet way, keeps the confidence envelope', () => {
  it('reads a fenced reply and a reply wrapped in prose', () => {
    const fenced = '```json\n{"data":{"title":"X"},"confidence":{"title":0.9}}\n```';
    expect(parseAIResponse(fenced)).toEqual({ data: { title: 'X' }, confidence: { title: 0.9 } });
    const prose = 'Here you go: {"data":{"price":"12"}} hope that helps';
    expect(parseAIResponse(prose)).toEqual({ data: { price: 12 }, confidence: { price: 0.7 } });
  });

  it("accepts the package's own { values, message } envelope", () => {
    expect(parseAIResponse('{"values":{"title":"X"},"message":"Set the title."}')).toEqual({
      data: { title: 'X' },
      confidence: { title: 0.7 },
    });
  });

  it('is null when there is no data to apply', () => {
    expect(parseAIResponse('no json here')).toBeNull();
    expect(parseAIResponse('{"title":"bare"}')).toBeNull();
  });
});
