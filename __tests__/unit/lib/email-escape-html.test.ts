import { describe, it, expect } from 'vitest';
import { escapeHtml } from '@/lib/email/templates/layout';

/**
 * This is the injection guard between a user-supplied display name / group
 * name / entity title and the HTML of an email. It was four identical copies
 * across the templates; these cases pin the one that is left.
 */
describe('escapeHtml', () => {
  it('leaves plain text untouched', () => {
    expect(escapeHtml('Weekly digest for Alice')).toBe('Weekly digest for Alice');
  });

  it('neutralises a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('escapes the ampersand first, so an escape cannot be double-decoded', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('escapes double quotes, which is what keeps a name inside an attribute', () => {
    expect(escapeHtml('" onmouseover="alert(1)')).toBe('&quot; onmouseover=&quot;alert(1)');
  });

  it('does NOT escape single quotes — attributes in these templates are double-quoted', () => {
    // Documented, deliberate: every attribute in layout.ts uses double quotes.
    // If a template ever emits attr='...', this expectation is the alarm.
    expect(escapeHtml("O'Brien")).toBe("O'Brien");
  });

  it('handles the empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
