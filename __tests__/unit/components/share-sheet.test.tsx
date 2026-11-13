// @vitest-environment jsdom
/**
 * The share sheet on a phone (QA 2026-11-12, iPhone 13, dark theme):
 * - "Share via..." was white text on the near-white bg-fg-primary button
 *   (1.2:1), and so was the header icon;
 * - the sheet had two close buttons 30px apart, the card's and the Dialog's;
 * - "Share on X" filled the post with the whole description, over 280.
 * The sheet is now the bip-kit ShareRow; these hold it to the same promises.
 */

import { cleanup, render, screen } from '@testing-library/react';
import ShareContent from '@/components/sharing/ShareContent';
import { xWeightedLength } from '@/lib/og/share-line';

const isMobile = vi.hoisted(() => ({ value: true }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => isMobile.value }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const DESCRIPTION =
  'Loki is the capability layer of a three-product thesis: a captain over a fleet of AI agents ' +
  'that builds and ships software for the projects people fund here, with every step on the ' +
  'record. '.repeat(6);

beforeEach(() => {
  isMobile.value = true;
  Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSheet(onClose: (() => void) | undefined = vi.fn()) {
  return render(
    <ShareContent
      title="Support: Loki"
      description={DESCRIPTION}
      url="https://orangecat.ch/projects/loki"
      onClose={onClose}
      titleText="Share Project"
    />
  );
}

describe('the share sheet on a phone', () => {
  // The white-on-white "Share via..." button is gone with the hand-built sheet:
  // the sheet is now @bitbaum/bip-kit's ShareRow, whose primary ink is
  // `--bp-on-fg`, tested in bip-kit itself (test/styles.test.js).
  it('is the shared share row, named for what is shared', () => {
    renderSheet();
    expect(screen.getByRole('navigation', { name: 'Share Project' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('has one close button', () => {
    renderSheet();
    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1);
  });

  it('keeps its own close button where there is no dialog around it', () => {
    isMobile.value = false;
    renderSheet();
    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Close share menu' })).toBeTruthy();
  });

  it('prefills X with one post, not the whole description', () => {
    renderSheet();
    const link = screen.getByRole('link', { name: 'Share on X' });
    const intent = new URL(link.getAttribute('href') ?? '');
    const text = intent.searchParams.get('text') ?? '';
    expect(intent.searchParams.get('url')).toBe('https://orangecat.ch/projects/loki');
    // X counts the link as 23, after a space.
    expect(xWeightedLength(text) + 1 + 23).toBeLessThanOrEqual(280);
    expect(text).toBe('Support: Loki');
  });
});
