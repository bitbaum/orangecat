/**
 * Every tool trigger is an English (or German) word, so a Russian message
 * never reached the tool phase — no cards, no search, no action tools.
 */

import { hasNonLatinSentence, messageMightNeedTools } from '@/services/cat/tool-use-detection';

describe('non-Latin messages reach the tool phase', () => {
  it('a Russian sentence triggers the routing step', () => {
    expect(
      messageMightNeedTools('я хочу создать платформу где люди будут вводить свои данные')
    ).toBe(true);
    expect(hasNonLatinSentence('Мне нужно, чтобы была форма')).toBe(true);
  });

  it('a stray non-Latin word does not', () => {
    expect(hasNonLatinSentence('my shop is called Кот')).toBe(false);
    expect(messageMightNeedTools('thanks Кот')).toBe(false);
  });
});
