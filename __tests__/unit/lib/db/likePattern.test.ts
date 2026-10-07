import { describe, expect, it } from 'vitest';
import { containsPattern, escapeLike, ilikeAny } from '@/lib/db/likePattern';

describe('likePattern', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
  });

  it('keeps commas and parentheses from rewriting an or() filter', () => {
    // Unquoted, "Smith, J" ended the first condition at the comma.
    expect(ilikeAny(['name', 'bio'], 'Smith, J (beta)')).toBe(
      'name.ilike."%Smith, J (beta)%",bio.ilike."%Smith, J (beta)%"'
    );
  });

  it('escapes quotes and backslashes inside the quoted value', () => {
    expect(ilikeAny(['title'], 'say "hi" 5%')).toBe('title.ilike."%say \\"hi\\" 5\\\\%%"');
  });
});
