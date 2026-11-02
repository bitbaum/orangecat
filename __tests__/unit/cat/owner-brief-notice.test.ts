import { ownerBriefNotice, type BriefFacts } from '@/services/cat/proactive';

const none: BriefFacts = {
  salesCount: 0,
  salesBtc: 0,
  bookingsCount: 0,
  overdueTitles: [],
  unread: 0,
};

describe('ownerBriefNotice — what the Cat may put on the owner’s phone', () => {
  it('sends nothing for an unread count alone (2026-11-02: "33 unread notifications")', () => {
    expect(ownerBriefNotice({ ...none, unread: 33 })).toBeNull();
  });

  it('names the overdue task and opens tasks', () => {
    const n = ownerBriefNotice({ ...none, overdueTitles: ['Pay placeB', 'Call Anna'], unread: 3 });
    expect(n?.title).toBe('Overdue: Pay placeB (+1 more)');
    expect(n?.action).toEqual({ label: 'Open tasks', path: '/dashboard/tasks' });
  });

  it('a booking opens bookings', () => {
    expect(ownerBriefNotice({ ...none, bookingsCount: 2 })?.action?.path).toBe(
      '/dashboard/bookings'
    );
  });

  it('a sale opens the store', () => {
    expect(ownerBriefNotice({ ...none, salesCount: 1, salesBtc: 0.001 })?.action?.path).toBe(
      '/dashboard/store'
    );
  });
});
