/**
 * INLINE markdown: the run of text inside one line.
 *
 * Bold, italic, code spans, links, bare URLs and @mentions. Block structure
 * (headings, quotes, fences, lists, tables) lives in ./blocks.
 */
import React from 'react';
import Link from 'next/link';
import { parseMentionCandidates } from '@/domain/mentions/parse';

type TokenType = 'text' | 'bold' | 'italic' | 'code' | 'mention' | 'url' | 'mdlink';

interface Token {
  type: TokenType;
  value: string;
  username?: string;
  url?: string;
  linkText?: string;
}

/**
 * Split a run of plain text into text and mention tokens.
 *
 * This used to be one alternative inside the regex below — `@[a-zA-Z0-9_]{1,30}`
 * — which was a THIRD definition of what a handle is, and it disagreed with the
 * other two in ways that showed on screen:
 *
 *   - No `.`, `-` or `+`, so `@dacota-plaettli` linked to /profiles/dacota and
 *     `@m.schaupensteiner` to /profiles/m. Both are real production accounts,
 *     and the resolver notifies them correctly while the post rendered a link
 *     to somebody else.
 *   - No word boundary, so `bob@example.com` in a post rendered `@example` as a
 *     profile link.
 *
 * Now there is one tokenizer. The renderer cannot ask the database who exists,
 * so it links the LONGEST candidate — the same preference the resolver applies
 * before checking existence — which also gives `ask @alice.` the right answer,
 * linking `@alice` and leaving the full stop as text.
 */
function expandMentions(text: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const mention of parseMentionCandidates(text)) {
    const handle = mention.candidates[0];
    if (mention.index > cursor) {
      tokens.push({ type: 'text', value: text.slice(cursor, mention.index) });
    }
    tokens.push({ type: 'mention', value: `@${handle}`, username: handle });
    cursor = mention.index + 1 + handle.length;
  }

  if (cursor < text.length) {
    tokens.push({ type: 'text', value: text.slice(cursor) });
  }
  return tokens;
}

function tokenize(text: string): Token[] {
  if (!text) {
    return [];
  }

  const tokens: Token[] = [];
  // mdlink must precede plain URL in alternation so [text](url) is matched first.
  // Mentions are NOT here: they are found by the shared parser, in the plain-text
  // runs between these matches, so a handle inside a link target stays untouched.
  // Code spans come FIRST: `**not bold**` inside backticks must stay literal.
  const combinedRegex =
    /(`[^`\n]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s<>[\]{}|\\^`"']+)/g;

  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(...expandMentions(text.slice(lastIndex, match.index)));
    }

    const m = match[0];

    if (m.startsWith('`')) {
      tokens.push({ type: 'code', value: m.slice(1, -1) });
    } else if (m.startsWith('[') && m.includes('](')) {
      const linkMatch = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        tokens.push({ type: 'mdlink', value: m, linkText: linkMatch[1], url: linkMatch[2] });
      }
    } else if (m.startsWith('**')) {
      tokens.push({ type: 'bold', value: m.slice(2, -2) });
    } else if (m.startsWith('*')) {
      tokens.push({ type: 'italic', value: m.slice(1, -1) });
    } else if (m.startsWith('http')) {
      tokens.push({ type: 'url', value: m, url: m });
    }

    lastIndex = match.index + m.length;
  }

  if (lastIndex < text.length) {
    tokens.push(...expandMentions(text.slice(lastIndex)));
  }
  return tokens;
}

function tokenToReact(token: Token, index: number): React.ReactNode {
  const key = `${token.type}-${index}`;
  switch (token.type) {
    case 'bold':
      return <strong key={key}>{token.value}</strong>;
    case 'italic':
      return <em key={key}>{token.value}</em>;
    case 'code':
      return (
        <code
          key={key}
          className="rounded border border-subtle bg-surface-raised px-1 py-0.5 font-mono text-code text-fg-primary"
        >
          {token.value}
        </code>
      );
    case 'mention':
      return (
        <Link
          key={key}
          href={`/profiles/${token.username}`}
          className="text-fg-primary hover:text-fg-primary hover:underline font-medium"
          onClick={e => e.stopPropagation()}
        >
          {token.value}
        </Link>
      );
    case 'mdlink':
      return (
        <a
          key={key}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fg-primary hover:text-fg-primary hover:underline font-medium"
          onClick={e => e.stopPropagation()}
        >
          {token.linkText}
        </a>
      );
    case 'url': {
      const displayUrl =
        token.url!.replace(/^https?:\/\//, '').slice(0, 40) + (token.url!.length > 50 ? '...' : '');
      return (
        <a
          key={key}
          href={token.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fg-primary hover:text-fg-primary hover:underline"
          onClick={e => e.stopPropagation()}
        >
          {displayUrl}
        </a>
      );
    }
    case 'text':
    default:
      return token.value;
  }
}

export function renderInlineTokens(text: string): React.ReactNode[] {
  const tokens = tokenize(text);
  return tokens.length === 0 ? [text] : tokens.map(tokenToReact);
}

export function renderMarkdownToReact(text: string): React.ReactNode[] {
  if (!text) {
    return [];
  }
  return renderInlineTokens(text);
}
