// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormField } from '@/components/create/FormField';
import { AIFillPanel } from '@/components/create/AIFillPanel';

// Voice input is env-gated behind FEATURES.voiceInput, evaluated at module-load
// time — mock the flag ON so the voice path is exercised regardless of the
// deployment default.
vi.mock('@/config/features', () => ({ FEATURES: { voiceInput: true } }));

vi.mock('@/components/ui/DictationButton', () => ({
  __esModule: true,
  DictationButton: ({
    onTranscript,
    ariaLabel,
  }: {
    onTranscript: (t: string) => void;
    ariaLabel?: string;
  }) => (
    <button onClick={() => onTranscript('voice-data')} aria-label={ariaLabel ?? 'Dictate'}>
      Voice
    </button>
  ),
  default: () => null,
}));

/**
 * Voice lives in the AI entry, not on individual fields.
 *
 * The mic used to render beside every text input and textarea, which put a
 * microphone icon on half the form and made voice look like a property of
 * inputs rather than a way to talk to the AI (founder: "mic logos on all
 * fields? this is crazy. just put it where ai entry is"). There is one AI
 * entry per form and exactly one mic, inside it.
 */
describe('voice placement', () => {
  it('renders NO mic on individual form fields', () => {
    for (const type of ['textarea', 'text'] as const) {
      const { unmount } = render(
        <FormField
          config={{ name: 'description', label: 'Description', type } as any}
          value={''}
          error={undefined}
          onChange={() => {}}
          onFocus={() => {}}
          disabled={false}
        />
      );
      expect(screen.queryByRole('button', { name: /voice|dictate/i })).toBeNull();
      unmount();
    }
  });

  it('renders ONE mic in the AI fill panel, appending to the description', () => {
    const onDescriptionChange = vi.fn();
    render(
      <AIFillPanel
        description="sell my bike"
        onDescriptionChange={onDescriptionChange}
        examples={[]}
        onSubmit={() => {}}
        busy={false}
        disabled={false}
      />
    );

    const mics = screen.getAllByRole('button', { name: /dictate/i });
    expect(mics).toHaveLength(1);

    fireEvent.click(mics[0]);
    expect(onDescriptionChange).toHaveBeenCalledWith('sell my bike voice-data');
  });
});
