import { describe, it, expect } from 'vitest';
import {
  AVATAR_HUES,
  AVATAR_SHAPES,
  avatarPath,
  faceForName,
  faceSvg,
  parseFaceUrl,
} from '@/config/companion-avatars';

describe('companion faces', () => {
  it('gives a name the same face every time, and different names different faces', () => {
    const a = faceForName('Funes');
    expect(faceForName('Funes')).toEqual(a);
    expect(faceForName('funes ')).not.toEqual(faceForName('Legal eagle'));
    expect(faceForName('')).toBeTruthy();
  });

  it('serves a face from a path it can read back', () => {
    const path = avatarPath('hex', 'pink');
    expect(parseFaceUrl(path)).toEqual({ shape: 'hex', hue: 'pink' });
    expect(parseFaceUrl(`https://orangecat.ch${path}`)).toEqual({ shape: 'hex', hue: 'pink' });
    expect(parseFaceUrl('https://example.com/cat.jpg')).toBeNull();
    expect(parseFaceUrl(avatarPath('nope', 'pink'))).toBeNull();
    expect(parseFaceUrl(null)).toBeNull();
  });

  it('draws every shape in every colour as one SVG with two eyes', () => {
    for (const shape of AVATAR_SHAPES) {
      for (const hue of AVATAR_HUES) {
        const svg = faceSvg(shape, hue);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain(`fill="${hue.fill}"`);
        expect(svg.match(/<rect/g)).toHaveLength(2);
      }
    }
  });

  it('has unique ids, so a picker can key on them', () => {
    expect(new Set(AVATAR_SHAPES.map(s => s.id)).size).toBe(AVATAR_SHAPES.length);
    expect(new Set(AVATAR_HUES.map(h => h.id)).size).toBe(AVATAR_HUES.length);
  });
});
