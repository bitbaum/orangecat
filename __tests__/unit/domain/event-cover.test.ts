/**
 * An event's cover comes from a real picture — the person's own photo, or one
 * generated with their own key — and never from a URL a model wrote. Without
 * either, the event is still made and the reply says where to add one.
 */
const latestChatImagePath = vi.fn();
const publishChatImage = vi.fn();
const generateAndStoreImage = vi.fn();

vi.mock('@/services/cat/chat-image-store', () => ({
  latestChatImagePath: (...a: unknown[]) => latestChatImagePath(...a),
  publishChatImage: (...a: unknown[]) => publishChatImage(...a),
}));
vi.mock('@/services/images/generate-and-store', () => ({
  generateAndStoreImage: (...a: unknown[]) => generateAndStoreImage(...a),
}));

import { coverPrompt, resolveEventCover } from '@/domain/events/cover';
import { imageFieldOf } from '@/lib/ai/assist-target';

const brief = {
  title: 'Electronic night',
  genres: ['Techno', 'House'],
  vibe: 'dark, sweaty, friendly',
  place: 'Espresso Bar',
};
const sb = {} as never;

beforeEach(() => {
  latestChatImagePath.mockReset();
  publishChatImage.mockReset();
  generateAndStoreImage.mockReset();
});

describe('event cover', () => {
  it('the event form has a cover field, so a Cat draft carries the chat photo', () => {
    expect(imageFieldOf('event')).toBe('banner_url');
  });

  it('uses the photo the person just sent, published only now', async () => {
    latestChatImagePath.mockResolvedValue('u1/cat/a.webp');
    publishChatImage.mockResolvedValue('https://cdn/u1/listing_a.webp');
    const cover = await resolveEventCover(sb, 'u1', 'chat_photo', brief);
    expect(publishChatImage).toHaveBeenCalledWith('u1/cat/a.webp', 'u1');
    expect(cover.banner_url).toBe('https://cdn/u1/listing_a.webp');
  });

  it('says so when there is no recent photo', async () => {
    latestChatImagePath.mockResolvedValue(null);
    const cover = await resolveEventCover(sb, 'u1', 'chat_photo', brief);
    expect(cover.banner_url).toBeNull();
    expect(cover.note).toMatch(/could not find a photo/);
  });

  it('generates with the person’s own key, describing the night without lettering', async () => {
    generateAndStoreImage.mockResolvedValue({ ok: true, url: 'https://cdn/gen.png' });
    const cover = await resolveEventCover(sb, 'u1', 'generate', brief);
    expect(cover.banner_url).toBe('https://cdn/gen.png');
    const prompt = generateAndStoreImage.mock.calls[0][2] as string;
    expect(prompt).toContain('Electronic night');
    expect(prompt).toContain('Techno, House');
    expect(prompt).toMatch(/no text/);
  });

  it('without an image key, points to where one is added — and to the other ways', async () => {
    generateAndStoreImage.mockResolvedValue({
      ok: false,
      code: 'NO_IMAGE_KEY',
      error: 'Image generation uses your own AI key. Add one in Settings → AI.',
    });
    const cover = await resolveEventCover(sb, 'u1', 'generate', brief);
    expect(cover.banner_url).toBeNull();
    expect(cover.note).toMatch(/Settings → AI/);
    expect(cover.note).toMatch(/upload one/);
  });

  it('asked for nothing, it adds nothing and says where a cover goes', async () => {
    const cover = await resolveEventCover(sb, 'u1', 'https://made-up.example/x.jpg', brief);
    expect(cover.banner_url).toBeNull();
    expect(latestChatImagePath).not.toHaveBeenCalled();
    expect(generateAndStoreImage).not.toHaveBeenCalled();
  });

  it('a bare brief still makes a prompt', () => {
    expect(coverPrompt({ title: 'Meetup', genres: [], vibe: null, place: null })).toMatch(
      /^Atmospheric cover photo for an event called "Meetup"\. /
    );
  });
});
