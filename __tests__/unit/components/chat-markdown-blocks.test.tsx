// @vitest-environment jsdom
/**
 * Block-level markdown in a Cat reply.
 *
 * `renderChatMarkdown` handled `##`/`###`, lists and GFM tables and nothing
 * else, so a model that quoted its own draft back at the user rendered the
 * marker as text — a reply that read:
 *
 *     >
 *     > Fixed price: 0.0005 BTC (~CHF 40). Tell me what you need…
 *
 * on screen, literal angle brackets and all. Code fences had the same hole:
 * the fence line rendered as ``` and the body was re-parsed as prose, so a
 * `# comment` inside a shell snippet became a heading.
 *
 * These pin the four block forms that were missing (quote, fence, inline code,
 * h1) and the two rules that make them safe: a fence wins over every other
 * block start, and markdown inside a code span stays literal.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderChatMarkdown } from '@/utils/markdown';

const renderChat = (text: string) => render(<div>{renderChatMarkdown(text)}</div>);

describe('blockquotes', () => {
  it('renders a quote instead of leaking the > marker', () => {
    const { container } = renderChat('> Fixed price: 0.0005 BTC');
    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(container.textContent).toBe('Fixed price: 0.0005 BTC');
    expect(container.textContent).not.toContain('>');
  });

  it('keeps consecutive quoted lines in ONE quote, blank markers included', () => {
    const { container } = renderChat('> first\n>\n> second');
    expect(container.querySelectorAll('blockquote')).toHaveLength(1);
    expect(container.textContent).toBe('firstsecond');
  });

  it('still formats inline markup inside a quote', () => {
    renderChat('> ask **alice** about it');
    expect(screen.getByText('alice').tagName).toBe('STRONG');
  });
});

describe('fenced code', () => {
  it('renders the body verbatim, not as prose', () => {
    const { container } = renderChat('```bash\n# not a heading\necho hi\n```');
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain('# not a heading');
    expect(pre!.textContent).toContain('echo hi');
    expect(container.textContent).not.toContain('```');
  });

  it('keeps blank lines and list markers inside the fence', () => {
    const { container } = renderChat('```\na\n\n- b\n```');
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('pre')!.textContent).toBe('a\n\n- b');
  });

  it('closes an unterminated fence at the end of the message', () => {
    // Streaming shows a half-written fence on every token until it closes.
    const { container } = renderChat('```\nstill typing');
    expect(container.querySelector('pre')!.textContent).toBe('still typing');
  });

  it('accepts tilde fences', () => {
    const { container } = renderChat('~~~\nx\n~~~');
    expect(container.querySelector('pre')!.textContent).toBe('x');
  });
});

describe('inline code', () => {
  it('renders a code span', () => {
    const { container } = renderChat('run `pnpm dev` first');
    expect(container.querySelector('code')!.textContent).toBe('pnpm dev');
  });

  it('leaves markdown inside a code span literal', () => {
    const { container } = renderChat('`**not bold**`');
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('code')!.textContent).toBe('**not bold**');
  });
});

describe('headings', () => {
  it('renders an h1 marker as a heading, not as text', () => {
    const { container } = renderChat('# Title');
    expect(container.textContent).toBe('Title');
  });

  it('still renders h2 and h3', () => {
    const { container } = renderChat('## Two\n### Three');
    expect(container.textContent).toBe('TwoThree');
  });
});
