// @vitest-environment jsdom
/**
 * The public "Contact email" is opt-in. The editor used to pre-fill it with the
 * sign-in email, so any save of the profile published the login address to
 * every visitor (QA 2026-11-10, /profiles/<username> signed out).
 */
import { renderHook } from '@testing-library/react';
import { useProfileEditor } from '@/components/profile/hooks/useProfileEditor';
import type { Profile } from '@/types/profile';

describe('profile editor never pre-fills the public contact email', () => {
  it('leaves contact_email empty when the profile has none, even with a sign-in email', () => {
    const { result } = renderHook(() =>
      useProfileEditor({
        profile: { id: 'u1', username: 'anya', contact_email: null } as unknown as Profile,
        userId: 'u1',
        userEmail: 'private@login.test',
        onSave: async () => {},
        onCancel: () => {},
      } as never)
    );
    expect(result.current.form.getValues('contact_email')).toBe('');
  });

  it('keeps a contact email the owner chose', () => {
    const { result } = renderHook(() =>
      useProfileEditor({
        profile: {
          id: 'u1',
          username: 'anya',
          contact_email: 'hello@anya.test',
        } as unknown as Profile,
        userId: 'u1',
        userEmail: 'private@login.test',
        onSave: async () => {},
        onCancel: () => {},
      } as never)
    );
    expect(result.current.form.getValues('contact_email')).toBe('hello@anya.test');
  });
});
