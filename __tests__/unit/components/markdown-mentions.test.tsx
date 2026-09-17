// @vitest-environment jsdom
/**
 * How a mention RENDERS, which was a third opinion on what a handle is.
 *
 * `src/utils/markdown.tsx` matched `@[a-zA-Z0-9_]{1,30}` inside its inline
 * regex — no dots, no hyphens, no word boundary — while the parser and the
 * resolver both accept dotted and hyphenated handles and both refuse the `@` in
 * an email address. The disagreement was visible on screen: real accounts
 * `dacota-plaettli` and `m.schaupensteiner` were notified correctly by the
 * resolver while the post linked to `/profiles/dacota` and `/profiles/m`, and
 * an email address in a post rendered its domain as a profile link.
 *
 * There were no tests on this file at all, which is how three definitions
 * survived. These pin the mention behaviour and the ordinary formatting that
 * had to keep working while the mention alternative was pulled out of the regex.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderMarkdownToReact } from '@/utils/markdown';

const renderText = (text: string) => render(<div>{renderMarkdownToReact(text)}</div>);

describe('rendering mentions in a post', () => {
  it('links a plain handle to its profile', () => {
    renderText('thanks @alice');
    expect(screen.getByRole('link', { name: '@alice' })).toHaveAttribute('href', '/profiles/alice');
  });

  it('links a HYPHENATED handle whole, not just the first word', () => {
    // Was: /profiles/dacota, with "-plaettli" left as loose text.
    renderText('welcome @dacota-plaettli');
    expect(screen.getByRole('link', { name: '@dacota-plaettli' })).toHaveAttribute(
      'href',
      '/profiles/dacota-plaettli'
    );
  });

  it('links a DOTTED handle whole', () => {
    // Was: /profiles/m
    renderText('cc @m.schaupensteiner');
    expect(screen.getByRole('link', { name: '@m.schaupensteiner' })).toHaveAttribute(
      'href',
      '/profiles/m.schaupensteiner'
    );
  });

  it('links a handle with a plus sign, as signup can mint', () => {
    renderText('ping @butaeff+ocauth2');
    expect(screen.getByRole('link', { name: '@butaeff+ocauth2' })).toHaveAttribute(
      'href',
      '/profiles/butaeff+ocauth2'
    );
  });

  it('does not turn an email address into a profile link', () => {
    // Was: @example rendered as a link to /profiles/example.
    renderText('write to bob@example.com');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('treats a trailing full stop as punctuation, not part of the handle', () => {
    renderText('ask @alice.');
    expect(screen.getByRole('link', { name: '@alice' })).toHaveAttribute('href', '/profiles/alice');
  });

  it('links the Cat like anybody else — it is an account, not a special case', () => {
    renderText('@cat what do you think?');
    expect(screen.getByRole('link', { name: '@cat' })).toHaveAttribute('href', '/profiles/cat');
  });

  it('links several mentions in one post', () => {
    renderText('@alice and @bob');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});

describe('the formatting that had to keep working', () => {
  it('still renders bold and italic', () => {
    const { container } = renderText('**loud** and *quiet*');
    expect(container.querySelector('strong')).toHaveTextContent('loud');
    expect(container.querySelector('em')).toHaveTextContent('quiet');
  });

  it('still renders a markdown link', () => {
    renderText('see [the docs](https://example.com/docs)');
    expect(screen.getByRole('link', { name: 'the docs' })).toHaveAttribute(
      'href',
      'https://example.com/docs'
    );
  });

  it('still renders a bare URL', () => {
    renderText('https://example.com/page');
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com/page');
  });

  it('leaves a handle inside a link target alone', () => {
    // The URL is consumed first, so its text is never re-scanned for mentions.
    renderText('[mail](https://example.com/u/@alice)');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'mail' })).toHaveAttribute(
      'href',
      'https://example.com/u/@alice'
    );
  });

  it('renders a mention next to formatting without swallowing either', () => {
    renderText('**hey** @alice');
    const { container } = renderText('**hey** @alice');
    expect(container.querySelector('strong')).toHaveTextContent('hey');
    expect(screen.getAllByRole('link', { name: '@alice' }).length).toBeGreaterThan(0);
  });

  it('renders plain text unchanged', () => {
    renderText('nothing special here');
    expect(screen.getByText('nothing special here')).toBeInTheDocument();
  });
});
