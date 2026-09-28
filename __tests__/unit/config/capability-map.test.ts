/**
 * The map is the newcomer's whole picture of the platform. A capability that
 * is missing from it, an intent heading with nothing under it, or copy in a
 * word the platform does not use, is a hole in that picture — so each of
 * those fails here rather than on a visitor.
 */
import { allCapabilities, buildCapabilityMap, FEATURE_CAPABILITIES } from '@/config/capability-map';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { INTENT_IDS, INTENT_LIST } from '@/config/intents';

/** Words the terminology guide bans (docs/design/TERMINOLOGY.md). */
const BANNED = /\b(donat\w*|tip|tips|crypto|campaign\w*|charit\w*|sats|satoshis?)\b/i;

function copyOf(c: { verb: string; what: string; example: string; steps: readonly string[] }) {
  return [c.verb, c.what, c.example, ...c.steps];
}

describe('the capability map', () => {
  it('carries every registry type exactly once', () => {
    const ids = allCapabilities()
      .filter(c => c.entityType)
      .map(c => c.entityType);
    expect([...ids].sort()).toEqual([...ENTITY_TYPES].sort());
  });

  it('puts something under every intent heading', () => {
    const empty = buildCapabilityMap()
      .filter(section => section.capabilities.length === 0)
      .map(section => section.intent.id);
    expect(empty).toEqual([]);
  });

  it('only uses intents that exist', () => {
    for (const c of allCapabilities()) {
      expect(INTENT_IDS).toContain(c.intent);
    }
    expect(INTENT_LIST.map(i => i.id)).toEqual([...INTENT_IDS]);
  });

  it('gives every capability a distinct verb, an example and exactly three steps', () => {
    const all = allCapabilities();
    const verbs = all.map(c => c.verb.trim().toLowerCase());
    expect(new Set(verbs).size).toBe(verbs.length);
    for (const c of all) {
      expect(c.verb.length).toBeGreaterThan(3);
      expect(c.what.length).toBeGreaterThan(10);
      expect(c.example.length).toBeGreaterThan(3);
      expect(c.steps).toHaveLength(3);
      expect(c.startHref.startsWith('/')).toBe(true);
    }
  });

  it('speaks in the platform vocabulary', () => {
    const offenders = allCapabilities()
      .flatMap(c => copyOf(c).map(line => ({ id: c.id, line })))
      .concat(INTENT_LIST.flatMap(i => [i.title, i.how].map(line => ({ id: i.id, line }))))
      .filter(({ line }) => BANNED.test(line));
    expect(offenders).toEqual([]);
  });

  it('starts a registry capability at its create path and points "see yours" at its list', () => {
    for (const type of ENTITY_TYPES) {
      const c = allCapabilities().find(x => x.entityType === type);
      expect(c?.startHref).toBe(ENTITY_REGISTRY[type].createPath);
      expect(c?.mineHref).toBe(ENTITY_REGISTRY[type].basePath);
    }
  });

  it('has no feature id colliding with an entity type', () => {
    for (const f of FEATURE_CAPABILITIES) {
      expect(ENTITY_TYPES as readonly string[]).not.toContain(f.id);
    }
  });
});
