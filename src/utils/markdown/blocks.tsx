/**
 * BLOCK markdown for a chat reply: the structure BETWEEN lines.
 *
 * Headings, blockquotes, fenced code, lists and GFM tables. Everything inside
 * a line is ./inline's job.
 *
 * Split out of the single markdown.tsx when adding quotes and fences pushed it
 * past the 300-line component limit. The two halves have genuinely different
 * shapes — one walks lines with a cursor, the other tokenises a string — and
 * only `renderInlineTokens` crosses between them.
 */
import React from 'react';
import { renderInlineTokens } from './inline';

export function renderChatMarkdown(text: string): React.ReactNode {
  if (!text) {
    return null;
  }

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code FIRST — everything inside a fence is literal, including the
    // blank lines and the `>`/`#`/`-` starts every branch below would claim.
    const fence = line.trimStart().match(/^(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const closing = new RegExp(`^\\s*${fence[1][0]}{3,}\\s*$`);
      const language = fence[2].trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !closing.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // consume the closing fence (or run off the end on an unclosed one)
      elements.push(
        <pre
          key={`pre-${i}`}
          className="my-2 overflow-x-auto rounded-md border border-subtle bg-surface-raised p-3"
        >
          <code className="font-mono text-xs leading-relaxed text-fg-primary">
            {body.join('\n')}
          </code>
          {language && <span className="sr-only">{` (${language})`}</span>}
        </pre>
      );
      continue;
    }

    if (!line.trim()) {
      elements.push(<div key={`blank-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Blockquote — consecutive `>` lines are ONE quote. Rendered as a real
    // quote instead of leaking the marker as text, which is what a model's
    // drafted copy ("> Fixed price: …") looked like on screen.
    if (/^>\s?/.test(line.trimStart())) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trimStart())) {
        quoted.push(lines[i].trimStart().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 border-l-2 border-default pl-3 text-fg-secondary"
        >
          {quoted.map((q, qi) =>
            q.trim() ? (
              <div key={`q-${qi}`}>{renderInlineTokens(q)}</div>
            ) : (
              <div key={`q-${qi}`} className="h-2" />
            )
          )}
        </blockquote>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <div key={`h1-${i}`} className="mb-1 mt-2 text-base font-semibold">
          {renderInlineTokens(line.slice(2))}
        </div>
      );
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
