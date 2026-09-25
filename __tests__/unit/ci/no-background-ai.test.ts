/**
 * Only a person asking may spend a model or embedding key.
 *
 * George, standing rule (2026-09-25): the AI keys on the box are free tiers —
 * the OpenRouter and Gemini keys are shared with every other app there — and
 * they may be spent only when a person deliberately asks (a click, a sent
 * message, a submitted form). His free credits ran out because jobs spent them
 * with nobody asking. What this repo was doing, and what replaced it:
 *
 *   - cat-health cron probed every vendor with real completions nightly — gone;
 *     the "Check Cat's status" button still runs the same probe on a click.
 *   - reindex-embeddings cron re-embedded the corpus nightly — gone; a save
 *     still indexes its own row (DB trigger → admin route, the person's write).
 *   - orangecat-cat-eval.timer ran the Cat eval + an LLM judge on the free pool
 *     nightly — timer gone, the script is run by hand.
 *   - cat-watches embedded every topic watch every 15 minutes — the vector is
 *     now stored when the user creates the watch, and the timer reads it.
 *   - GET /api/cat/nudges (dashboard MOUNT, and the weekly-digest cron) asked
 *     the free model for "smart" nudges and embedded the bio — removed.
 *   - GET /api/cat/suggestions (opening the chat) had the free model write the
 *     chips — they are deterministic now.
 *
 * The walk is TRANSITIVE: none of those routes imported a model client itself.
 * It follows every runtime import (`import type` is erased) from each entry to
 * a SINK — a module that calls a vendor. Two refinements keep it honest rather
 * than noisy, and both are checked below so neither can quietly widen:
 *
 *   - MIXED modules export both spending and non-spending functions (the Cat's
 *     memory module lists memories AND embeds them). An import of only the
 *     listed safe names is not followed, and each safe name's body is checked
 *     not to call a sink.
 *   - Routes whose GET is reachable by a browser without a click, but which
 *     import a sink for a POST or a person-initiated probe, are allowlisted
 *     with the reason a reviewer can check. Adding one is a decision.
 *
 * The cat-mentions worker is the one timer allowed to reach the model, because
 * it only answers a message in which a person addressed @cat — a person asking,
 * delivered by a queue. It is named here so that exception stays one line.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(__dirname, '../../..');

/** Modules that call a model or embedding vendor with a platform key. */
const SINKS = new Set([
  'src/services/ai/embeddings.ts',
  'src/services/ai/groq.ts',
  'src/services/ai/openrouter.ts',
  'src/services/ai/openai-compat.ts',
  'src/services/ai/free-model-pool.ts',
  'src/services/ai/platform-providers.ts',
  'src/services/ai/index.ts',
  'src/services/cat/platform-llm.ts',
  'src/services/cat/provider-resolver.ts',
  'src/services/cat/health-probes.ts',
  'src/services/cat/web-research.ts',
  'src/services/images/generate.ts',
]);

/** A value import of ai-kit's model-calling entry points is a sink wherever it appears. */
const AI_KIT_CALL =
  /import\s+(?!type\b)\{[^}]*\b(complete|completeStream|freeChain|usableChain|resolveChain|createAiHealthHandler|webSearch)\b[^}]*\}\s*from\s*['"]@bitbaum\/ai-kit/;

/** Modules that both spend and not; importing only these names is safe. */
const MIXED: Record<string, string[]> = {
  'src/services/cat/memory.ts': [
    'listMemories',
    'listMemoriesResult',
    'deleteMemory',
    'deleteAllMemories',
    'looksLikeSelfDisclosure',
    'selectForgetFacts',
    'MemoryAiService',
  ],
  'src/services/companions/memory.ts': [
    'listCompanionMemories',
    'deleteCompanionMemory',
    'deleteAllCompanionMemories',
  ],
};

/** The one timer that may reach the model — see the header. */
const PERSON_ASKED_TIMERS = new Set(['src/app/api/cron/cat-mentions/route.ts']);

/** GET routes that import a sink but do not spend on a plain GET. */
const GET_ALLOWED = new Map([
  ['src/app/api/cat/diagnose/route.ts', 'runs the probe only from a click ("Check Cat\'s status")'],
  ['src/app/api/health/ai/route.ts', 'a real call only with ?probe=1 AND AI_PROBE_SECRET'],
  ['src/app/api/v1/search/route.ts', 'embeds the query a person typed into search'],
  ['src/app/api/cat/capacity/route.ts', 'reads Groq constants + in-process observations'],
  ['src/app/api/ai/images/generate/route.ts', 'GET reports availability; POST generates'],
  ['src/app/api/cat/actions/route.ts', 'GET lists actions; POST executes one'],
  ['src/app/api/cat/permissions/route.ts', 'GET reads permissions; imports the action registry'],
  ['src/app/api/cat/interests/route.ts', 'GET lists interests; POST publishes (embeds)'],
]);

type Chain = string[];

function read(file: string): string | null {
  try {
    return readFileSync(join(ROOT, file), 'utf8');
  } catch {
    return null; // missing, or a directory
  }
}

/** Runtime imports of a file, each with the names it binds (null = whole module). */
function importsOf(code: string): { spec: string; names: string[] | null }[] {
  const out: { spec: string; names: string[] | null }[] = [];
  const re =
    /(?:import|export)\s+(?!type\b)([^;]*?)\s*from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of code.matchAll(re)) {
    if (m[3]) {
      out.push({ spec: m[3], names: null });
      continue;
    }
    const clause = m[1];
    const braces = clause.match(/^\{([^}]*)\}$/s);
    const names = braces
      ? braces[1]
          .split(',')
          .map(
            n =>
              n
                .trim()
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/)[0]
          )
          .filter(Boolean)
      : null;
    out.push({ spec: m[2], names });
  }
  return out;
}

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/')
    ? join('src', spec.slice(2))
    : spec.startsWith('.')
      ? join(dirname(from), spec)
      : null;
  if (!base) {
    return null;
  }
  for (const c of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    if (/\.tsx?$/.test(c) && read(c) !== null) {
      return c;
    }
  }
  return null;
}

/** The import chain from `entry` to a sink, or null. `src` is injectable for the self-test. */
function pathToModel(
  entry: string,
  src: (f: string) => string | null = read,
  resolve: (from: string, spec: string) => string | null = resolveSpec
): Chain | null {
  const seen = new Set<string>();
  const queue: Chain[] = [[entry]];
  while (queue.length) {
    const chain = queue.shift()!;
    const file = chain[chain.length - 1];
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    const code = src(file);
    if (code === null) {
      continue;
    }
    if (SINKS.has(file) || AI_KIT_CALL.test(code)) {
      return chain;
    }
    for (const { spec, names } of importsOf(code)) {
      const next = resolve(file, spec);
      if (!next) {
        continue;
      }
      const safe = MIXED[next];
      if (safe && names && names.every(n => safe.includes(n))) {
        continue;
      }
      queue.push([...chain, next]);
    }
  }
  return null;
}

function files(dir: string, keep: (name: string) => boolean): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) {
    return [];
  }
  return readdirSync(abs).flatMap(name => {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      return files(rel, keep);
    }
    return keep(name) ? [rel] : [];
  });
}

const cronRoutes = files('src/app/api/cron', n => n === 'route.ts');
const apiRoutes = files('src/app/api', n => n === 'route.ts');
const renderModules = files('src/app', n => /\.tsx?$/.test(n) && n !== 'route.ts');

function exportsGet(file: string): boolean {
  return /export\s+(?:async\s+function\s+GET\b|const\s+GET\b|\{[^}]*\bGET\b[^}]*\})/.test(
    read(file) ?? ''
  );
}

describe('the walker can fail', () => {
  it('finds a model call two hops down, and honours the mixed-module rule both ways', () => {
    const tree: Record<string, string> = {
      'src/app/api/cron/x/route.ts': "import { run } from '@/lib/job';",
      'src/lib/job.ts': "import { embedText } from '@/services/ai/embeddings';",
      'src/services/ai/embeddings.ts': 'export const embedText = 1;',
      'src/app/api/cron/y/route.ts': "import { listMemories } from '@/services/cat/memory';",
      'src/app/api/cron/z/route.ts': "import { recall } from '@/services/cat/memory';",
      'src/services/cat/memory.ts': "import { embedText } from '@/services/ai/embeddings';",
      'src/app/api/cron/k/route.ts': "import { complete } from '@bitbaum/ai-kit';",
    };
    const src = (f: string) => tree[f] ?? null;
    const res = (from: string, spec: string) => {
      const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : null;
      return base && `${base}.ts` in tree ? `${base}.ts` : null;
    };
    expect(pathToModel('src/app/api/cron/x/route.ts', src, res)).toEqual([
      'src/app/api/cron/x/route.ts',
      'src/lib/job.ts',
      'src/services/ai/embeddings.ts',
    ]);
    expect(pathToModel('src/app/api/cron/y/route.ts', src, res)).toBeNull();
    expect(pathToModel('src/app/api/cron/z/route.ts', src, res)).not.toBeNull();
    expect(pathToModel('src/app/api/cron/k/route.ts', src, res)).not.toBeNull();
  });

  it('found the routes and pages at all', () => {
    expect(cronRoutes.length).toBeGreaterThan(5);
    expect(apiRoutes.length).toBeGreaterThan(50);
    expect(renderModules.length).toBeGreaterThan(50);
  });
});

describe('no timer spends a key', () => {
  it('no cron route reaches a model, except the one answering a person', () => {
    const leaks = cronRoutes
      .filter(r => !PERSON_ASKED_TIMERS.has(r))
      .map(r => pathToModel(r))
      .filter((c): c is Chain => c !== null)
      .map(c => c.join(' -> '));
    expect(leaks).toEqual([]);
  });

  it('the cat-mentions exception still exists and is still a reply to a mention', () => {
    for (const r of PERSON_ASKED_TIMERS) {
      expect(read(r)).toContain('runCatMentions');
    }
  });

  it('no timer this repo installs runs a script that calls a model', () => {
    const units = files('scripts/systemd', n => n.endsWith('.service'));
    const scripts = units.flatMap(u =>
      [...(read(u) ?? '').matchAll(/scripts\/([\w.-]+\.mjs)/g)].map(m => `scripts/${m[1]}`)
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) {
      expect(read(s), s).not.toMatch(
        /openrouter\.ai|api\.groq\.com|generativelanguage|api\.openai\.com|\/api\/cat\/chat/
      );
    }
  });

  it('every orangecat-cron timer points at a cron route the walk covered', () => {
    const timers = files('scripts/systemd', n => /^orangecat-cron@.+\.timer$/.test(n));
    for (const t of timers) {
      const name = t.match(/orangecat-cron@(.+)\.timer$/)![1];
      expect(cronRoutes, t).toContain(`src/app/api/cron/${name}/route.ts`);
    }
  });

  it('the retired units are not installed again', () => {
    const deploy = read('scripts/deploy-selfhost.sh') ?? '';
    const units = deploy.slice(deploy.indexOf('UNITS=('), deploy.indexOf('RETIRED=('));
    for (const u of ['orangecat-cat-eval', 'reindex-embeddings', 'cat-health']) {
      expect(units).not.toContain(u);
    }
    for (const gone of ['cat-health', 'reindex-embeddings']) {
      expect(existsSync(join(ROOT, 'src/app/api/cron', gone))).toBe(false);
    }
  });
});

describe('no page load spends a key', () => {
  it('no page, layout or component under src/app reaches a model', () => {
    const leaks = renderModules
      .map(f => pathToModel(f))
      .filter((c): c is Chain => c !== null)
      .map(c => c.join(' -> '));
    expect(leaks).toEqual([]);
  });

  it('no GET a browser can send unasked reaches a model, beyond the reviewed list', () => {
    const leaks = apiRoutes
      // Cron routes answer GET too, but only to the box's own timer with
      // CRON_SECRET; they are held to the stricter rule above.
      .filter(r => exportsGet(r) && !GET_ALLOWED.has(r) && !cronRoutes.includes(r))
      .map(r => pathToModel(r))
      .filter((c): c is Chain => c !== null)
      .map(c => c.join(' -> '));
    expect(leaks).toEqual([]);
  });

  it('the Cat home and the dashboard nudges are NOT on that list', () => {
    for (const r of ['src/app/api/cat/suggestions/route.ts', 'src/app/api/cat/nudges/route.ts']) {
      expect(GET_ALLOWED.has(r)).toBe(false);
      expect(pathToModel(r)).toBeNull();
    }
  });

  it('every allowlisted GET still exists (a stale entry hides nothing, but misleads)', () => {
    for (const r of GET_ALLOWED.keys()) {
      expect(read(r), r).not.toBeNull();
    }
  });
});

describe('the mixed-module escape hatch stays narrow', () => {
  it('each safe name exists and its body calls nothing that spends', () => {
    for (const [file, names] of Object.entries(MIXED)) {
      const code = read(file) ?? '';
      for (const name of names) {
        // A plain re-export (`export { name }`) has no body here to spend in.
        if (new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*;`).test(code)) {
          continue;
        }
        const start = code.search(
          new RegExp(`export\\s+(?:async\\s+)?(?:function|interface|type)\\s+${name}\\b`)
        );
        expect(start, `${file}: ${name}`).toBeGreaterThanOrEqual(0);
        const end = code.indexOf('\n}\n', start);
        const body = code.slice(start, end === -1 ? undefined : end);
        expect(body, `${file}: ${name}`).not.toMatch(/\bembedTexts?\(|\bcallPlatform|complete\(/);
      }
    }
  });
});
