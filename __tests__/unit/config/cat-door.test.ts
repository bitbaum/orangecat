/** What a visitor typed is carried through sign-up, and shown on the way. */
import {
  CAT_DOOR,
  catHrefWithSentence,
  registerHrefKeepingSentence,
  sentenceFromReturnPath,
} from '@/config/cat-door';
import { ROUTES } from '@/config/routes';
import { safeReturnPath } from '@/lib/oauth/handoff';

const sentence = 'Sell my old bike & the trailer?';

describe('carrying a sentence to the Cat', () => {
  it('opens the Cat with the sentence asked', () => {
    const href = catHrefWithSentence(sentence);
    expect(href.startsWith(`${ROUTES.DASHBOARD.CAT}?`)).toBe(true);
    expect(new URL(href, 'https://x').searchParams.get('q')).toBe(sentence);
  });

  it('registers first, with a return path the sign-in accepts', () => {
    const href = registerHrefKeepingSentence(sentence);
    expect(href.startsWith(`${ROUTES.AUTH_REGISTER}&from=`)).toBe(true);
    const from = new URL(href, 'https://x').searchParams.get('from');
    expect(safeReturnPath(from)).toBe(catHrefWithSentence(sentence));
    expect(sentenceFromReturnPath(from)).toBe(sentence);
  });

  it('finds no sentence in any other return path', () => {
    expect(sentenceFromReturnPath(null)).toBeNull();
    expect(sentenceFromReturnPath('/dashboard')).toBeNull();
    expect(sentenceFromReturnPath('/dashboard/cat?welcome=true')).toBeNull();
    expect(sentenceFromReturnPath('/dashboard/cat?q=%20')).toBeNull();
    expect(sentenceFromReturnPath('//evil.example/dashboard/cat?q=hi')).toBeNull();
  });

  it('shows no more than a door accepts', () => {
    const long = 'x'.repeat(CAT_DOOR.maxLength + 50);
    expect(sentenceFromReturnPath(catHrefWithSentence(long))).toHaveLength(CAT_DOOR.maxLength);
  });
});
