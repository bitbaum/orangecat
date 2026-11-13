import { describe, expect, it } from 'vitest';
import { linkify } from '@/components/legal/linkify';

describe('linkify (legal paragraphs)', () => {
  it('turns an email address into a mailto link and keeps the words around it', () => {
    expect(linkify('Cato — cato@orangecat.ch')).toEqual([
      { kind: 'text', text: 'Cato — ' },
      { kind: 'link', text: 'cato@orangecat.ch', href: 'mailto:cato@orangecat.ch' },
    ]);
  });

  it('links a web address without swallowing the full stop after it', () => {
    expect(linkify('See https://orangecat.ch/docs.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', text: 'https://orangecat.ch/docs', href: 'https://orangecat.ch/docs' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('leaves a paragraph with no address as one piece of text', () => {
    expect(linkify('We will respond within 30 days.')).toEqual([
      { kind: 'text', text: 'We will respond within 30 days.' },
    ]);
  });
});
