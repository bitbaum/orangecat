// @vitest-environment jsdom
/**
 * One on/off row shape: the switch is named by the visible words, described
 * by the detail line, and the whole row is a 44px target. Privacy rows say
 * the action ("Hide website"), so on means hidden, in words.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { SettingToggleRow } from '@/components/ui/SettingToggleRow';
import { PrivacySection } from '@/components/profile/sections/PrivacySection';
import { HIDEABLE_PROFILE_FIELDS } from '@/config/profile-privacy';
import type { ProfileFormValues } from '@/components/profile/types';

describe('SettingToggleRow', () => {
  it('names the switch with the visible label and describes it with the detail', () => {
    const onChange = vi.fn();
    render(
      <SettingToggleRow
        label="Social"
        detail="Follows, mentions and replies."
        checked={false}
        onCheckedChange={onChange}
      />
    );
    const toggle = screen.getByRole('switch', { name: 'Social' });
    expect(toggle.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Social').closest('label')?.className).toMatch(/\bmin-h-11\b/);
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

function PrivacyHarness() {
  const form = useForm<ProfileFormValues>({ defaultValues: { privacy_settings: null } as never });
  return <PrivacySection form={form} />;
}

describe('profile privacy rows', () => {
  it('say the action, and the accessible name is the same words', () => {
    render(<PrivacyHarness />);
    for (const { label } of HIDEABLE_PROFILE_FIELDS) {
      const name = `Hide ${label.toLowerCase()}`;
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.getByRole('switch', { name })).toBeTruthy();
    }
  });
});
