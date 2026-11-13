// @vitest-environment jsdom
/**
 * media#3: when the photo search fails, the picker says so and offers the two
 * ways on (ask again, upload your own) instead of "No images found".
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageSuggestPicker from '@/components/images/ImageSuggestPicker';
import { IMAGE_SEARCH_DOWN_MESSAGE } from '@/config/images';

const suggestImages = vi.fn();
vi.mock('@/services/images/suggest-client', () => ({
  suggestImages: (...args: unknown[]) => suggestImages(...args),
}));
vi.mock('@/services/images/generate-client', () => ({
  fetchImageGenCapability: async () => ({ canGenerate: false }),
}));
vi.mock('@/components/images/ImageGeneratePanel', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('@/components/images/ImageUploadPanel', () => ({
  __esModule: true,
  default: () => <div>upload panel</div>,
}));

beforeEach(() => {
  suggestImages.mockReset();
  window.localStorage.clear();
});

describe('ImageSuggestPicker when the photo search is down', () => {
  it('names the outage, not "no images", and offers Try again and Upload', async () => {
    suggestImages.mockRejectedValue(new Error(IMAGE_SEARCH_DOWN_MESSAGE));
    render(<ImageSuggestPicker title="Rain" body="" onPick={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText(IMAGE_SEARCH_DOWN_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/no images found/i)).not.toBeInTheDocument();

    suggestImages.mockResolvedValue({ queries: ['rain'], images: [] });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(suggestImages).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/no images found/i)).toBeInTheDocument();
  });

  it('"Upload your own" opens the upload panel', async () => {
    suggestImages.mockRejectedValue(new Error(IMAGE_SEARCH_DOWN_MESSAGE));
    render(<ImageSuggestPicker title="Rain" body="" onPick={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /upload your own/i }));
    expect(screen.getByText('upload panel')).toBeInTheDocument();
  });
});
