import {
  coverColumn,
  coverFieldMapping,
  entityCover,
  entityCoverImages,
} from '@/lib/entities/cover';
import { buildUpdatePayload } from '@/lib/api/buildUpdatePayload';
import { entityCardImage } from '@/lib/og/entity-card-figure';

const A = 'https://cdn.example.com/a.jpg';
const B = 'https://cdn.example.com/b.jpg';
const C = 'https://cdn.example.com/c.jpg';

describe('entityCoverImages', () => {
  it('leads with the cover, then the gallery, without repeats', () => {
    expect(entityCoverImages('product', { thumbnail_url: A, images: [B, A, C] })).toEqual([
      A,
      B,
      C,
    ]);
    expect(entityCoverImages('event', { banner_url: A, thumbnail_url: B, images: [C] })).toEqual([
      A,
      B,
      C,
    ]);
  });

  it('falls back to the gallery for a row saved before the kind had a cover', () => {
    expect(entityCover('service', { cover_image_url: null, images: [B] })).toBe(B);
    expect(entityCover('service', { cover_image_url: A, images: [B] })).toBe(A);
  });

  it('is empty for a row with no picture, and for a kind without one', () => {
    expect(entityCoverImages('cause', { cover_image_url: '' })).toEqual([]);
    expect(entityCover('loan', {})).toBeNull();
    expect(entityCover('wallet', { cover_image_url: A })).toBeNull();
  });

  it.each(['cause', 'loan', 'asset', 'research', 'project', 'wishlist', 'circle'] as const)(
    '%s: the share card carries the same picture as the page',
    type => {
      expect(entityCardImage(type, { cover_image_url: A })).toBe(A);
      expect(entityCardImage(type, { cover_image_url: A })).toBe(
        entityCover(type, { cover_image_url: A })
      );
    }
  );

  it('the share card of a product, an event and an investment reads their cover column', () => {
    expect(entityCardImage('product', { thumbnail_url: A, images: [B] })).toBe(A);
    expect(entityCardImage('event', { banner_url: A, thumbnail_url: B })).toBe(A);
    expect(entityCardImage('investment', { thumbnail_url: A })).toBe(A);
  });
});

describe('coverColumn', () => {
  it('names the kind’s own column and stores nothing as null', () => {
    expect(coverColumn('cause', { cover_image_url: ` ${A} ` })).toEqual({ cover_image_url: A });
    expect(coverColumn('investment', { thumbnail_url: A })).toEqual({ thumbnail_url: A });
    expect(coverColumn('loan', { cover_image_url: '' })).toEqual({ cover_image_url: null });
    expect(coverColumn('asset', {})).toEqual({ cover_image_url: null });
    expect(coverColumn('wallet', { cover_image_url: A })).toEqual({});
  });
});

describe('coverFieldMapping', () => {
  const build = (data: Record<string, unknown>) =>
    buildUpdatePayload(data, [{ from: 'title' }, ...coverFieldMapping('service')]);

  it('writes a new picture', () => {
    expect(build({ title: 'T', cover_image_url: A })).toEqual({ title: 'T', cover_image_url: A });
  });

  it('a removed picture (null or empty) clears the column', () => {
    expect(build({ cover_image_url: null })).toEqual({ cover_image_url: null });
    expect(build({ cover_image_url: '' })).toEqual({ cover_image_url: null });
  });

  it('an update that does not mention the picture leaves it alone', () => {
    expect(build({ title: 'T' })).toEqual({ title: 'T' });
  });

  it('is empty for a kind without a picture', () => {
    expect(coverFieldMapping('document')).toEqual([]);
  });
});
