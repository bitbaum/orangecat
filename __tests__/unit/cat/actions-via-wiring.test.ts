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
 * Same, with every run of whitespace collapsed to one space.
 *
 * A gate that pins an exact single-line call fails the moment the formatter
 * wraps that call across lines — which says nothing about whether the wiring
 * is right, and trains whoever hits it to weaken the assertion. Collapsing
 * whitespace keeps the assertion about ARGUMENTS, which is the wiring, while
 * letting prettier put them wherever they fit.
 */
function normalizedSource(relPath: string): string {
  return sourceWithoutComments(relPath).replace(/\s+/g, ' ');
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
    const src = normalizedSource('src/services/cat/tool-use.ts');
    // Call syntax, not a bare identifier: a mention cannot satisfy this.
    // The plan is asked WITH what we have already observed for this credential
    // — a plan that ignores the observation can never stop re-asking a model
    // that has already refused.
    expect(src).toContain('toolPlanForModel(modelToUse, observedToolVerdict(modelToUse, toolKey))');
    // And BOTH observations have to be written down. Asserting the shared
    // prefix was not enough: deleting the success call left the refusal call
    // satisfying it, and a mutant walked straight through this gate. The two
    // sites answer different questions and neither substitutes for the other.
    //
    //   the refusal — the ONLY thing that can ever stop the loop re-sending
    //   definitions to a model that has already said no.
    expect(src).toContain('recordToolAttempt(modelToUse, toolKey, { status: res.status, bodyText:');
    //   the success — what makes `native` stick, so a later 429 or context
    //   overflow cannot demote a model we have SEEN call a tool.
    expect(src).toContain(
      'recordToolAttempt(modelToUse, toolKey, { status: res.status, parsed: data });'
    );
    // No provider-name comparison may come back — that is the second,
    // drifting list this change removed.
    expect(src).not.toContain("provider === 'openrouter'");
    expect(src).not.toContain("provider === 'groq'");
    expect(src).not.toContain('providerSupportsNativeTools');
  });

  it('is the SAME fact the orchestrator derives actionsVia from', () => {
    const src = normalizedSource('src/services/cat/chat-orchestrator.ts');
    // Same three terms as the loop, in the same order: the model, whether we
    // hold credentials, and what that credential has been observed to do. If
    // the prompt's claim were derived from fewer terms than the wire, the two
    // could disagree — which is the whole reason this gate exists.
    expect(src).toContain(
      'actionsViaForModel( modelToUse, Boolean(toolEndpoint && toolKey), observedToolVerdict(modelToUse, toolKey) )'
    );
    expect(src).toContain('actionsVia,');
    // If this one still asked the provider while the loop asked the model,
    // the prompt and the wire could disagree — which is the whole point.
    expect(src).not.toContain('providerSupportsNativeTools(provider)');
  });

  it('never guesses an endpoint: the resolver supplies it or there are no tools', () => {
    const src = normalizedSource('src/services/cat/tool-use.ts');
    expect(src).toContain('opts?.toolEndpoint');
    // A guessed endpoint would send a user's own model id to somebody else's
    // vendor with somebody else's key — worse than sending nothing.
    expect(src).not.toContain('PROVIDER_BASE_URLS.openrouter');
    expect(src).not.toContain('PROVIDER_BASE_URLS.groq');
  });
});

describe('the local-model route claims exactly what it can do', () => {
  // /api/cat/prepare builds a prompt for a model in the user's OWN browser;
  // what comes back is /api/cat/local-complete. These two must agree, and the
  // history of this pair is why the gate exists at all:
  //
  //   ADR-0006 D8 — local-complete only saved messages, so the prompt was made
  //   to say Cat could not act. True, and a dead end.
  //   ADR-0008 D2 — local-complete now parses the envelope and runs it through
  //   the same executor as the hosted path, so the prompt may say it can.
  //
  // The invariant survived both and is the only thing worth pinning: the
  // PROMPT'S CLAIM and the ROUTE'S CAPABILITY are one fact. When they drifted
  // apart, the user was told work had happened that nothing would ever do.
  const prepare = sourceWithoutComments('src/app/api/cat/prepare/route.ts');
  const localComplete = sourceWithoutComments('src/app/api/cat/local-complete/route.ts');

  it('has an executor on the return leg', () => {
    // Call syntax, comments stripped: a mention cannot satisfy this.
    expect(localComplete).toContain('runExecActions(supabase, user.id, actorId, actions)');
    expect(localComplete).toContain('parseActionsFromResponse(reply)');
  });

  it("claims 'prose' — and only because the executor above is real", () => {
    expect(prepare).toContain("actionsVia: 'prose'");
    // The linkage, which is the whole gate: if the executor is ever removed
    // from local-complete, claiming anything but 'none' is a lie. This fails
    // on the NEXT edit that guts the route while leaving the claim behind.
    const canAct = localComplete.includes('runExecActions(');
    expect(
      canAct,
      "prepare claims Cat can act, but local-complete no longer runs anything — set actionsVia back to 'none' or restore the executor"
    ).toBe(true);
  });

  it("never claims 'tools' on a path that cannot send tool definitions", () => {
    // The model runs in the browser; the server makes no inference call, so
    // there is no round trip to put definitions in. 'tools' means the prose
    // catalogue was DROPPED because definitions replace it — claim it here and
    // Cat is left with no verb at all.
    expect(prepare).not.toContain("actionsVia: 'tools'");
  });

  it('stores the cleaned message, not the envelope', () => {
    // The block itself was the false announcement: saved verbatim, the user
    // read "Creating that now…" as a thing that had happened.
    expect(localComplete).toContain('content: cleanedMessage');
    expect(localComplete).not.toContain('content: reply');
  });
});
