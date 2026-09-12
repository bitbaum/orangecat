import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { declaredToolVerdict, toolPlanForModel } from '@/services/cat/tool-capability';

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

/**
 * Tool capability is ONE fact, and it is a fact about the MODEL.
 *
 * This gate used to pin the answer to `TOOL_CAPABLE_PROVIDERS`, a list of two
 * provider names. That list denied tools to every user who brought their own
 * OpenAI, Together, DeepSeek or xAI key — models that all speak OpenAI-style
 * function calling — so the person paying a frontier vendor got the least
 * capable Cat. The gate's INTENT survives unchanged: whatever decides whether
 * the loop sends tools must be the same thing that decides what the prompt
 * claims Cat can do, or a user is told an action ran on a path that was never
 * given the definitions to run it.
 */
describe('tool capability is one fact, asked of the model', () => {
  it('never turns an uncatalogued model into a denial', () => {
    // The trap one layer down: reading silence from a hand-maintained registry
    // as "no tools" refuses every model it has not heard of, without asking.
    expect(declaredToolVerdict('some-vendor/never-catalogued')).toBe('unobserved');
    expect(toolPlanForModel('some-vendor/never-catalogued').sendTools).toBe(true);
  });

  it('is what the tool layer branches on, not a hardcoded provider list', () => {
    const src = sourceWithoutComments('src/services/cat/tool-use.ts');
    // Call syntax, not a bare identifier: a mention cannot satisfy this.
    expect(src).toContain('toolPlanForModel(modelToUse)');
    // No provider-name comparison may come back — that is the second,
    // drifting list this change removed.
    expect(src).not.toContain("provider === 'openrouter'");
    expect(src).not.toContain("provider === 'groq'");
    expect(src).not.toContain('providerSupportsNativeTools');
  });

  it('is the SAME fact the orchestrator derives actionsVia from', () => {
    const src = sourceWithoutComments('src/services/cat/chat-orchestrator.ts');
    expect(src).toContain('actionsViaForModel(modelToUse, Boolean(toolEndpoint && toolKey))');
    expect(src).toContain('actionsVia,');
    // If this one still asked the provider while the loop asked the model,
    // the prompt and the wire could disagree — which is the whole point.
    expect(src).not.toContain('providerSupportsNativeTools(provider)');
  });

  it('never guesses an endpoint: the resolver supplies it or there are no tools', () => {
    const src = sourceWithoutComments('src/services/cat/tool-use.ts');
    expect(src).toContain('opts?.toolEndpoint');
    // A guessed endpoint would send a user's own model id to somebody else's
    // vendor with somebody else's key — worse than sending nothing.
    expect(src).not.toContain('PROVIDER_BASE_URLS.openrouter');
    expect(src).not.toContain('PROVIDER_BASE_URLS.groq');
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
