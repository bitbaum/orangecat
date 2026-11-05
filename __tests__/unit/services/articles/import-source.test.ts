import { describe, expect, it } from 'vitest';
import {
  bodyWithAttribution,
  importSourceAllowed,
  parseImportedArticle,
} from '@/services/articles/import-source';

describe('importSourceAllowed', () => {
  it('accepts https fleet hosts only', () => {
    expect(importSourceAllowed('https://biaslens.orangecat.ch/api/writing/abc')?.hostname).toBe(
      'biaslens.orangecat.ch'
    );
    expect(importSourceAllowed('https://orangecat.ch/api/x')?.hostname).toBe('orangecat.ch');
    expect(importSourceAllowed('http://biaslens.orangecat.ch/api/writing/abc')).toBeNull();
    expect(importSourceAllowed('https://evil.example/orangecat.ch')).toBeNull();
    expect(importSourceAllowed('https://notorangecat.ch/x')).toBeNull();
    expect(importSourceAllowed('https://user:pw@biaslens.orangecat.ch/x')).toBeNull();
    expect(importSourceAllowed('not a url')).toBeNull();
  });
});

describe('parseImportedArticle', () => {
  const host = 'biaslens.orangecat.ch';

  it('reads the article envelope and keeps a fleet canonical link', () => {
    const article = parseImportedArticle(
      {
        ok: true,
        article: {
          title: ' T ',
          body: ' B ',
          excerpt: 'E',
          canonical: 'https://biaslens.orangecat.ch/articles/abc',
          author: 'Anna',
        },
      },
      host
    );
    expect(article).toEqual({
      title: 'T',
      body: 'B',
      excerpt: 'E',
      canonical: 'https://biaslens.orangecat.ch/articles/abc',
      author: 'Anna',
      host,
    });
  });

  it('drops a canonical link that points off the fleet, and refuses non-articles', () => {
    expect(
      parseImportedArticle({ title: 'T', body: 'B', canonical: 'https://x.example/a' }, host)
        ?.canonical
    ).toBeUndefined();
    expect(parseImportedArticle({ title: '', body: 'B' }, host)).toBeNull();
    expect(parseImportedArticle('text', host)).toBeNull();
    expect(parseImportedArticle(null, host)).toBeNull();
  });
});

describe('bodyWithAttribution', () => {
  it('says where the piece first appeared, when known', () => {
    const base = { title: 'T', body: 'Body.', host: 'biaslens.orangecat.ch' };
    expect(bodyWithAttribution(base)).toBe('Body.');
    expect(
      bodyWithAttribution({ ...base, canonical: 'https://biaslens.orangecat.ch/articles/abc' })
    ).toBe(
      'Body.\n\n---\n\n*First published on [biaslens.orangecat.ch](https://biaslens.orangecat.ch/articles/abc).*'
    );
  });
});
