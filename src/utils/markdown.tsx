import React from 'react';
import Link from 'next/link';
import { publicProfilePath } from '@/config/public-profile-path';

type TokenType = 'text' | 'bold' | 'italic' | 'mention' | 'url' | 'mdlink';

interface Token {
  type: TokenType;
  value: string;
  username?: string;
  url?: string;
  linkText?: string;
}

function tokenize(text: string): Token[] {
  if (!text) {
    return [];
  }

  const tokens: Token[] = [];
  // mdlink must precede plain URL in alternation so [text](url) is matched first
  const combinedRegex =
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|@[a-zA-Z0-9_]{1,30}|https?:\/\/[^\s<>[\]{}|\\^`"']+)/g;

  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const m = match[0];

    if (m.startsWith('[') && m.includes('](')) {
      const linkMatch = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        tokens.push({ type: 'mdlink', value: m, linkText: linkMatch[1], url: linkMatch[2] });
      }
    } else if (m.startsWith('**')) {
      tokens.push({ type: 'bold', value: m.slice(2, -2) });
    } else if (m.startsWith('*')) {
      tokens.push({ type: 'italic', value: m.slice(1, -1) });
    } else if (m.startsWith('@')) {
      tokens.push({ type: 'mention', value: m, username: m.slice(1) });
    } else if (m.startsWith('http')) {
      tokens.push({ type: 'url', value: m, url: m });
    }

    lastIndex = match.index + m.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
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
    case 'mention':
      return (
        <Link
          key={key}
          href={publicProfilePath(token.username!)}
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

function renderInlineTokens(text: string): React.ReactNode[] {
  const tokens = tokenize(text);
  return tokens.length === 0 ? [text] : tokens.map(tokenToReact);
}

export function renderMarkdownToReact(text: string): React.ReactNode[] {
  if (!text) {
    return [];
  }
  return renderInlineTokens(text);
}

export function renderChatMarkdown(text: string): React.ReactNode {
  if (!text) {
    return null;
  }

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      elements.push(<div key={`blank-${i}`} className="h-2" />);
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <div key={`h3-${i}`} className="font-semibold text-sm mt-2 mb-0.5">
          {renderInlineTokens(line.slice(4))}
        </div>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <div key={`h2-${i}`} className="font-semibold mt-2 mb-0.5">
          {renderInlineTokens(line.slice(3))}
        </div>
      );
      i++;
      continue;
    }

    if (/^[-*] /.test(line.trimStart())) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trimStart())) {
        const content = lines[i].trimStart().replace(/^[-*] /, '');
        items.push(<li key={`li-${i}`}>{renderInlineTokens(content)}</li>);
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-0.5 my-1">
          {items}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line.trimStart())) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trimStart())) {
        const content = lines[i].trimStart().replace(/^\d+\.\s/, '');
        items.push(<li key={`oli-${i}`}>{renderInlineTokens(content)}</li>);
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-0.5 my-1">
          {items}
        </ol>
      );
      continue;
    }

    // GFM table: a "| a | b |" header row followed by a "|---|---|" separator.
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^[\s|:-]+$/.test(lines[i + 1].trim()) &&
      lines[i + 1].includes('-') &&
      lines[i + 1].includes('|')
    ) {
      const parseRow = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map(c => c.trim());
      const headers = parseRow(line);
      i += 2; // consume header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      elements.push(
        <div key={`tbl-${i}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th
                    key={hi}
                    className="border border-default bg-surface-raised px-2 py-1 text-left font-semibold"
                  >
                    {renderInlineTokens(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-default px-2 py-1 align-top">
                      {renderInlineTokens(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    elements.push(<div key={`p-${i}`}>{renderInlineTokens(line)}</div>);
    i++;
  }

  return <>{elements}</>;
}
