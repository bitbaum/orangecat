import {
  CREATE_CATEGORY_LABELS,
  CREATE_OPTIONS,
  CREATE_PAGE,
  groupCreateOptions,
} from '@/config/create-options';
import { ENTITY_REGISTRY, getEntitiesForCreateMenu } from '@/config/entity-registry';
import { INTENT_IDS, INTENTS } from '@/config/intents';

describe('CREATE_OPTIONS', () => {
  it('offers writing first, then every registry create path', () => {
    expect(CREATE_OPTIONS[0]?.href).toBe('/articles/new');
    expect(CREATE_OPTIONS[1]?.href).toBe('/timeline?compose=true');
    const hrefs = CREATE_OPTIONS.slice(2).map(option => option.href);
    expect([...hrefs].sort()).toEqual(
      getEntitiesForCreateMenu()
        .map(entity => entity.createPath)
        .sort()
    );
  });

  it('does not collapse the chooser into project-create only', () => {
    expect(CREATE_PAGE.title).toMatch(/create/i);
    expect(CREATE_OPTIONS.some(option => option.href.includes('/store/create'))).toBe(true);
    expect(CREATE_OPTIONS.filter(option => option.href.includes('/projects/create'))).toHaveLength(
      1
    );
  });

  it('reads the registry plain copy, with the type name as a small label', () => {
    const product = CREATE_OPTIONS.find(o => o.href === ENTITY_REGISTRY.product.createPath);
    expect(product).toMatchObject({
      name: ENTITY_REGISTRY.product.plain.verb,
      description: ENTITY_REGISTRY.product.plain.example,
      typeLabel: ENTITY_REGISTRY.product.name,
      category: ENTITY_REGISTRY.product.plain.intent,
    });
  });

  it('groups by intent, in the intents order, each intent once', () => {
    const groups = groupCreateOptions();
    expect(groups[0]).toMatchObject({ category: 'content', label: 'Share' });
    const intents = groups.slice(1).map(group => group.category);
    expect(intents).toEqual(INTENT_IDS.filter(id => intents.includes(id)));
    expect(new Set(intents).size).toBe(intents.length);
    for (const id of INTENT_IDS) {
      expect(CREATE_CATEGORY_LABELS[id]).toBe(INTENTS[id].title);
    }
  });
});
