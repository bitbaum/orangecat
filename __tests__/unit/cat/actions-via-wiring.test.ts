import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOOL_CAPABLE_PROVIDERS,
  providerSupportsNativeTools,
} from '@/config/ai-provider-runtime';

/**
 * `actionsVia` only earns its keep if the three places that disagree about what
 * Cat can do are wired to ONE fact (ADR-0006 D7/D8):
 *
 *   1. whether tool definitions are sent        (services/cat/tool-use.ts)
 *   2. whether the prompt claims Cat can act    (services/cat/system-prompt.ts)
 *   3. what the local-model route promises      (api/cat/prepare/route.ts)
 *
 * They used to be independent. When (2) was more generous than (1) or (3), the
 * user was told an action had run on a path where nothing could run it.
 *
 * These are source assertions because what they pin is a WIRING decision: the
 * value a call site passes. Comments are stripped before matching — an earlier
 * gate in this repo passed against a mutant with the code deleted, because an
 * explanatory comment happened to name the identifier it searched for.
 */

const ROOT = join(__dirname, '../../..');

function sourceWithoutComments(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('provider tool capability is one fact', () => {
  it('names the two providers that actually serve OrangeCat', () => {
    expect([...TOOL_CAPABLE_PROVIDERS]).toEqual(['groq', 'openrouter']);
  });

  it('answers for the providers either way', () => {
    expect(providerSupportsNativeTools('groq')).toBe(true);
    expect(providerSupportsNativeTools('openrouter')).toBe(true);
    // Local models and every un-adapted provider.
    expect(providerSupportsNativeTools('ollama')).toBe(false);
    expect(providerSupportsNativeTools('openai')).toBe(false);
    expect(providerSupportsNativeTools('')).toBe(false);
  });

  it('is what the tool layer branches on, not a second hardcoded list', () => {
    const src = sourceWithoutComments('src/services/cat/tool-use.ts');
    // Call syntax, not a bare identifier: a mention cannot satisfy this.
    expect(src).toContain('if (!providerSupportsNativeTools(provider)) {');
    // The string comparison it replaced must be gone, or the two can drift.
    expect(src).not.toContain("provider === 'openrouter'");
  });

  it('is what the orchestrator derives actionsVia from', () => {
    const src = sourceWithoutComments('src/services/cat/chat-orchestrator.ts');
    expect(src).toContain("providerSupportsNativeTools(provider) ? 'tools' : 'prose'");
    expect(src).toContain('actionsVia,');
  });
});

describe('the local-model route admits it cannot act', () => {
  // /api/cat/prepare builds a prompt for a model in the user's own browser.
  // The only thing that comes back is /api/cat/local-complete, which saves
  // messages — there is no executor, so an exec_action block is stored as
  // literal text and the user reads it as work that happened.
  const src = sourceWithoutComments('src/app/api/cat/prepare/route.ts');

  it("passes actionsVia: 'none' to prepareCatChat", () => {
    expect(src).toContain("actionsVia: 'none'");
  });

  it('still has no executor to justify anything else', () => {
    // If this route ever grows one, this test should fail and be rewritten —
    // that is the point. Silence here would leave the prompt lying again.
    const localComplete = sourceWithoutComments('src/app/api/cat/local-complete/route.ts');
    expect(localComplete).not.toContain('CatActionExecutor');
    expect(localComplete).not.toContain('parseActionsFromResponse');
  });
});
