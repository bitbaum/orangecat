import { ownerNoticeBody } from '@/services/loki/notify-owner';

describe('ownerNoticeBody — what OrangeCat hands Loki’s notify gateway', () => {
  it('turns the one action into an absolute https button', () => {
    const body = ownerNoticeBody(
      {
        source: 'cat-watch',
        title: 'Your watch fired: BTC under 60k',
        action: { label: 'Open the Cat', path: '/dashboard/cat' },
      },
      'https://orangecat.ch'
    );
    expect(body.actions).toEqual([
      { label: 'Open the Cat', url: 'https://orangecat.ch/dashboard/cat' },
    ]);
    expect(body.urgency).toBe('today');
  });

  it('sends no button for list-only notices (ops alerts never ring the phone)', () => {
    const body = ownerNoticeBody(
      { source: 'ops', title: 'provider_outage', body: 'Groq 503' },
      'https://orangecat.ch'
    );
    expect(body.actions).toEqual([]);
  });

  it('keeps labels inside Loki’s 24-character limit', () => {
    const body = ownerNoticeBody(
      { source: 'cat', title: 't', action: { label: 'x'.repeat(40), path: '/' } },
      'https://orangecat.ch/'
    );
    expect(body.actions[0].label).toHaveLength(24);
    expect(body.actions[0].url).toBe('https://orangecat.ch/');
  });
});
