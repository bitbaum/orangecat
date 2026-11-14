/**
 * "Writing as" above the conversation list (ADR-0015 D5): when there is a
 * choice to show, and what it says.
 */
import { memberLabel, writingAsChoice } from '@/components/identities/WritingAs';
import type { IdentityCircle, IdentityMember } from '@/lib/identities/client';

const member = (extra: Partial<IdentityMember>): IdentityMember => ({
  id: 'x',
  username: null,
  name: null,
  avatarUrl: null,
  isHolder: false,
  isCurrent: false,
  ...extra,
});
const circle = (members: IdentityMember[], canManage = true): IdentityCircle => ({
  members,
  max: 5,
  canManage,
});

describe('which name you are writing as', () => {
  it('is not shown to somebody with one name: there is nothing to choose', () => {
    expect(writingAsChoice(circle([member({ id: 'a', isCurrent: true })]))).toBeNull();
    expect(writingAsChoice(null)).toBeNull();
  });

  it('is not shown to an identity that stands alone and cannot switch', () => {
    expect(
      writingAsChoice(circle([member({ id: 'a', isCurrent: true }), member({ id: 'b' })], false))
    ).toBeNull();
  });

  it('names the one in use and lists the others, what is waiting first', () => {
    const choice = writingAsChoice(
      circle([
        member({ id: 'a', name: 'Cato', isCurrent: true }),
        member({ id: 'b', name: 'Quiet' }),
        member({ id: 'c', name: 'Busy', waiting: 4 }),
        member({ id: 'd', name: 'Some', waiting: 1 }),
      ])
    );
    expect(choice?.current.id).toBe('a');
    expect(choice?.others.map(m => m.id)).toEqual(['c', 'd', 'b']);
    expect(choice?.waiting).toBe(5);
  });

  it('calls a member by its name, else its handle', () => {
    expect(memberLabel({ name: ' Cato ', username: 'cato' })).toBe('Cato');
    expect(memberLabel({ name: '', username: 'cato' })).toBe('@cato');
    expect(memberLabel({ name: null, username: null })).toBe('Unnamed');
  });
});
