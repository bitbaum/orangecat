/**
 * A kind is called one thing, and that thing is its ENTITY_REGISTRY name.
 *
 * The full-path review (2026-11-13) found the agent kind under five names —
 * Bots in the sidebar, Companions on the Discover chip and "My Companions",
 * "AI Assistant Not Found" as a 404 title, "Create a companion" in the Create
 * menu, "a being" under the form — and Organization, Document and Research
 * each under two or three ("Create New Group", "Cat Context", "DeSci
 * Research"). Every one was a hand-typed label beside a registry that already
 * held the name. These tests pin the name and keep the old labels out.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { COMPANION_COPY } from '@/config/companions';

describe('the agent kind is a Bot', () => {
  const bot = ENTITY_REGISTRY.ai_assistant;

  it('is named Bot / Bots (ADR-0015, the sidebar, the Talk home)', () => {
    expect(bot.name).toBe('Bot');
    expect(bot.namePlural).toBe('Bots');
    expect(bot.createActionLabel).toBe('Create a bot');
    expect(bot.plain.verb).toBe('Create a bot');
  });

  it('the Talk home reads its title from the registry', () => {
    expect(COMPANION_COPY.talk.title).toBe(bot.namePlural);
    expect(COMPANION_COPY.talk.newCompanion).toBe('New bot');
  });

  it('keeps its code type, table and URLs', () => {
    expect(bot.type).toBe('ai_assistant');
    expect(bot.publicBasePath).toBe('/companions');
    expect(bot.apiEndpoint).toBe('/api/ai-assistants');
  });
});

describe('Organization is spelled one way', () => {
  it('the Create menu verb uses the registry spelling', () => {
    expect(ENTITY_REGISTRY.group.name).toBe('Organization');
    expect(ENTITY_REGISTRY.group.plain.verb).toBe('Start an organization');
  });
});

/** Hand-typed labels that named a kind something other than its registry name. */
const RETIRED_LABELS = [
  'AI Assistant Not Found',
  "'AI Assistants'",
  "'Create AI assistant'",
  "'Create AI Assistant'",
  "'Create a companion'",
  "'No companions yet'",
  "'Companion memory'",
  "default: 'Companions'",
  "default: 'Companion'",
  'a being with its own voice',
  'AI being',
  'Create Cat Context',
  'title="Cat Context"',
  'createButtonLabel="Add Context"',
  'title="DeSci Research"',
  "'Create New Group'",
  "'Group Label'",
  "'Group Name'",
  "'Group Type'",
  "'Start an organisation'",
  "default: 'Group'",
  "default: 'New Group'",
  '>Group settings<',
  'Back to Group\n',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe('no visible label renames a kind', () => {
  const files = sourceFiles(join(process.cwd(), 'src'));

  it.each(RETIRED_LABELS)('nothing in src/ writes %s', label => {
    const hits = files.filter(file => readFileSync(file, 'utf8').includes(label));
    expect(hits).toEqual([]);
  });
});
