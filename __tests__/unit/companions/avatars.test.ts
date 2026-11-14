import { describe, it, expect } from 'vitest';
import {
  AVATAR_HUES,
  AVATAR_SHAPES,
  avatarPath,
  faceForName,
  faceSvg,
  findHue,
  parseFaceUrl,
  RETIRED_HUES,
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

describe('no bot wears orange (one-orange rule, agents#14)', () => {
  it('has no orange or amber pigment to pick', () => {
    expect(AVATAR_HUES.map(h => h.id)).not.toContain('orange');
    expect(AVATAR_HUES.map(h => h.id)).not.toContain('amber');
    expect(AVATAR_HUES.map(h => h.fill.toLowerCase())).not.toContain('#ff7a1a');
    expect(AVATAR_HUES.map(h => h.fill.toLowerCase())).not.toContain('#ffa726');
  });

  it('keeps the list the same length, so every other name keeps its face', () => {
    expect(AVATAR_HUES).toHaveLength(11);
    expect(AVATAR_HUES[3].id).toBe('indigo');
    expect(AVATAR_HUES[4].id).toBe('steel');
  });

  it('draws a stored orange face in its replacement, and reads it back as that', async () => {
    for (const [retired, replacement] of Object.entries(RETIRED_HUES)) {
      expect(findHue(retired)?.id).toBe(replacement);
      expect(parseFaceUrl(avatarPath('hex', retired))).toEqual({ shape: 'hex', hue: replacement });
    }
    const route = await import('@/app/api/ai-assistants/avatar/route');
    const svg = await route
      .GET(new Request('https://orangecat.ch/api/ai-assistants/avatar?shape=star&hue=orange'))
      .text();
    expect(svg).toContain('fill="#46327E"');
  });
});

describe('the avatar route', () => {
  it('serves the face its address names (it was static, and drew every face black)', async () => {
    const route = await import('@/app/api/ai-assistants/avatar/route');
    expect((route as { dynamic?: string }).dynamic).not.toBe('force-static');
    const res = route.GET(
      new Request('https://orangecat.ch/api/ai-assistants/avatar?shape=star&hue=pink')
    );
    const svg = await res.text();
    expect(svg).toContain('fill="#FF2E9A"');
  });
});
