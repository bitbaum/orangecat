/**
 * A picture for every kind: one cover column per kind (ENTITY_COVER), and
 * every surface reads and writes that column.
 *
 * The full-path review (2026-11-13) found 3 of 14 create forms with a picture
 * field and 0 pictures on 70 Discover cards. These pin the fix so a new kind,
 * or a new form, cannot quietly go without one again.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ENTITY_COVER, coverFieldOf } from '@/config/entity-cover';
import { getEntityConfig } from '@/config/entity-configs/get-config';
import { coverPictureField, withCoverField } from '@/config/entity-configs/base-config-factory';
import { ENTITY_TYPES, getTableName, type EntityType } from '@/config/entity-registry';
import { imageFieldOf } from '@/lib/ai/assist-target';

const WITH_COVER = ENTITY_TYPES.filter(type => ENTITY_COVER[type] !== null);
const WITHOUT_COVER = ENTITY_TYPES.filter(type => ENTITY_COVER[type] === null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fieldsOf = (config: any): { name: string; type: string; label: string }[] =>
  (config.fieldGroups ?? []).flatMap((group: { fields?: unknown[] }) => group.fields ?? []);

describe('ENTITY_COVER', () => {
  it('answers for every kind; only the two private kinds have no picture', () => {
    expect([...WITHOUT_COVER].sort()).toEqual(['document', 'wallet']);
    for (const type of WITH_COVER) {
      expect(coverFieldOf(type)).toMatch(/^[a-z_]+$/);
    }
  });

  it.each(WITH_COVER)('%s: the form shows exactly one picture field, on the cover column', type => {
    const config = getEntityConfig(type);
    expect(config).not.toBeNull();
    const covers = fieldsOf(config).filter(field => field.name === coverFieldOf(type));
    expect(covers).toHaveLength(1);
    expect(covers[0].type).toBe('image');
    expect(covers[0].label).toBe(ENTITY_COVER[type]!.label);
  });

  it.each(WITH_COVER)('%s: the picture sits right under the description', type => {
    const names = fieldsOf(getEntityConfig(type)).map(field => field.name);
    const at = names.indexOf(coverFieldOf(type)!);
    if (names.includes('description')) {
      expect(names[at - 1]).toBe('description');
    }
  });

  it.each(WITH_COVER)('%s: the validation schema keeps the cover', type => {
    const config = getEntityConfig(type)!;
    const field = coverFieldOf(type)!;
    const url = 'https://example.com/cover.jpg';
    // Only the cover key matters: other required fields may fail, the parsed
    // shape is read from a strip of the schema's own keys.
    const parsed = config.validationSchema.safeParse({ ...config.defaultValues, [field]: url });
    const issues = parsed.success ? [] : parsed.error.issues;
    expect(issues.filter(issue => issue.path[0] === field)).toEqual([]);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>)[field]).toBe(url);
    }
  });

  it.each(WITH_COVER)('%s: a wizard shows the picture in one of its steps', type => {
    const wizard = getEntityConfig(type)!.wizardConfig;
    if (wizard?.enabled) {
      expect(wizard.steps.flatMap(step => step.fields)).toContain(coverFieldOf(type));
    }
  });

  it('a photo sent to the Cat lands on the cover', () => {
    for (const type of WITH_COVER) {
      // project also has a logo field; the cover comes first in the form.
      expect(imageFieldOf(type)).toBe(coverFieldOf(type));
    }
  });

  it('a kind without a picture gets no field', () => {
    expect(coverPictureField('wallet')).toBeNull();
    const groups = [{ id: 'a', title: 'A', fields: [] }];
    expect(withCoverField('document', groups)).toBe(groups);
  });

  it('a config that already names the cover field keeps one, in the standard place', () => {
    const groups = withCoverField('product', [
      {
        id: 'basic',
        title: 'Basic',
        fields: [
          { name: 'title', label: 'Title', type: 'text' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'price', label: 'Price', type: 'number' },
          { name: 'thumbnail_url', label: 'Photo', type: 'image' },
        ],
      },
    ]);
    expect(groups[0].fields!.map(f => f.name)).toEqual([
      'title',
      'description',
      'thumbnail_url',
      'price',
    ]);
    expect(groups[0].fields![2].label).toBe('Cover picture');
  });
});

describe('the database reads the same columns', () => {
  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const latest = fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.sql'))
    .sort()
    .filter(name =>
      /CREATE OR REPLACE FUNCTION public\.public_documents\(\)/.test(
        fs.readFileSync(path.join(dir, name), 'utf8')
      )
    )
    .pop()!;
  const sql = fs.readFileSync(path.join(dir, latest), 'utf8');

  /** The image expression of one kind's branch in public_documents(). */
  function imageExpression(type: EntityType): string {
    const table = getTableName(type);
    const branch = sql
      .split('UNION ALL')
      .find(part => new RegExp(`FROM public\\.${table} x`).test(part));
    if (!branch) {
      throw new Error(`no branch for ${type}`);
    }
    // SELECT kind, id, title, match_title, body, <image>, path_key, handle …
    return (
      branch
        .split('\n')
        .find((_, i, lines) => /x\.description|x\.name, x\.description/.test(lines[i - 1] ?? '')) ??
      ''
    );
  }

  it.each(WITH_COVER)('%s: Discover and search lead with the cover column', type => {
    const expression = imageExpression(type);
    const field = coverFieldOf(type)!;
    const first = expression.match(/x\.([a-z_]+)/)?.[1];
    expect(first).toBe(field);
  });
});
