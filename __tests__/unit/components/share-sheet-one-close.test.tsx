// @vitest-environment jsdom
/**
 * The share sheet on a phone has one frame and one close button.
 *
 * It used to wrap its own framed card (border, shadow, X) inside the dialog,
 * which brings its own frame and X: two close buttons, one inside the other.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({ mobile: true }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => media.mobile }));

import ShareContent from '@/components/sharing/ShareContent';

function renderSheet() {
  return render(
    <ShareContent
      title="Ana"
      description="Ana on OrangeCat"
      url="https://orangecat.ch/profiles/ana"
      onClose={() => {}}
      titleText="Share profile"
    />
  );
}

describe('share sheet', () => {
  it('has exactly one close button on a phone', () => {
    media.mobile = true;
    renderSheet();
    const closes = screen
      .getAllByRole('button')
      .filter(b => /close/i.test(b.getAttribute('aria-label') ?? b.textContent ?? ''));
    expect(closes).toHaveLength(1);
  });

  it('keeps its own close button as a dropdown on a wide screen', () => {
    media.mobile = false;
    renderSheet();
    expect(screen.getByRole('button', { name: 'Close share menu' })).toBeTruthy();
  });

  it('says "Copy link" in sentence case', () => {
    media.mobile = false;
    renderSheet();
    expect(screen.getByText('Copy link')).toBeTruthy();
  });
});
