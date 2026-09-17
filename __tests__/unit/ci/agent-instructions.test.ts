/**
 * The instructions under `.claude/` are loaded into every agent session, so a
 * stale one is not a stale document — it is a wrong instruction executed.
 *
 * Two had rotted for months, and the way they rotted is the point:
 *
 *  - `.claude/CLAUDE.md` forbids the Supabase MCP in a warning block, and then
 *    said, 70 lines earlier, "Create database migration via MCP". It also
 *    CLAIMED that "`mcp_supabase_*` examples elsewhere in `.claude/` have been
 *    replaced" while three command scripts still printed ten of them. Writing
 *    down that something was handled feels like handling it.
 *  - Every command script drove the repo with `npm`, which moved to
 *    `pnpm@11` — including a hook whose advice for a lockfile conflict was
 *    `npm install`, i.e. "write the lockfile this repo must not have". One
 *    worktree was found carrying exactly that stray package-lock.json.
 *
 * So: a prohibition may NAME the retired thing — that is what a prohibition is
 * — but nothing under `.claude/` may demonstrate or invoke it.
 *
 * Comments are stripped from the executable files before checking. A gate that
 * reads comments can be satisfied by prose, and equally can be TRIPPED by prose
 * explaining the very thing it forbids, which is what the fix's own comments
 * do.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const CLAUDE_DIR = join(process.cwd(), '.claude');

/** Shell, minus comment lines and blank lines — what the script actually does. */
function shellCode(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(line => !/^\s*#/.test(line) && line.trim() !== '')
    .join('\n');
}

function scriptsIn(dir: string): string[] {
  const full = join(CLAUDE_DIR, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter(f => f.endsWith('.sh'))
    .map(f => join(full, f));
}

const EXECUTABLES = [...scriptsIn('commands'), ...scriptsIn('hooks')];

/** Anything that reads as "this is forbidden / gone" rather than "do this". */
const NEGATED = /retired|deprecated|never|do NOT|don't|no longer|must not|should not/i;

describe('agent instructions: the retired Supabase MCP', () => {
  it('finds the scripts it is meant to police', () => {
    // A glob that matches nothing passes every assertion below it. If the
    // scripts move, this fails rather than quietly certifying an empty set.
    expect(EXECUTABLES.length).toBeGreaterThan(3);
  });

  it.each(EXECUTABLES)('%s does not invoke it', path => {
    expect(shellCode(path)).not.toMatch(/mcp_supabase_|mcp__claude_ai_Supabase__/);
  });

  it('is named in markdown only to forbid it', () => {
    const offenders: string[] = [];
    for (const file of markdownUnderClaude()) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/mcp_supabase_|mcp__claude_ai_Supabase__/.test(line)) return;
        // A prohibition is a paragraph, not a line: "RETIRED" and "do NOT" sit
        // at the top of the warning block and the token appears two lines
        // below. Look at the sentence around it, not just the line the token
        // landed on — while keeping the window tight enough that a fresh
        // example cannot hide under an unrelated warning further up.
        const window = lines.slice(Math.max(0, i - 3), i + 2).join('\n');
        if (NEGATED.test(window)) return;
        offenders.push(`${file.replace(process.cwd(), '.')}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('agent instructions: this repo is pnpm', () => {
  it('really is, or the rule below is wrong', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });

  it.each(EXECUTABLES)('%s drives the repo with pnpm, not npm', path => {
    // `npm ` and `npx ` at a command position. pnpm's own names contain "npm",
    // hence the boundary: `pnpm audit` must not read as `npm audit`.
    expect(shellCode(path)).not.toMatch(/(^|[\s;&|(`$])(npm|npx)\s/m);
  });

  it('never tells anyone to write an npm lockfile here', () => {
    const offenders: string[] = [];
    for (const file of [...EXECUTABLES, ...markdownUnderClaude()]) {
      const body = file.endsWith('.sh') ? shellCode(file) : readFileSync(file, 'utf8');
      body.split('\n').forEach((line, i) => {
        // The boundary matters: `npm install` is a SUBSTRING of `pnpm install`,
        // so without it this flags every correct line and nothing else.
        if (!/(^|[\s;&|(`$'"])npm (install|update|ci)\b/.test(line)) return;
        if (NEGATED.test(line)) return;
        offenders.push(`${file.replace(process.cwd(), '.')}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

/** Every .md under .claude/, recursively — rules/ and commands/ included. */
function markdownUnderClaude(dir = CLAUDE_DIR): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    // sessions/ is a log of what happened, not an instruction. Rewriting a past
    // note to match present tooling would falsify the record.
    if (entry.isDirectory()) {
      if (entry.name === 'sessions' || entry.name === 'worktrees') continue;
      out.push(...markdownUnderClaude(full));
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}
