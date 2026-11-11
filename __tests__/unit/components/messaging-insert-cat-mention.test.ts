// @vitest-environment jsdom
import { insertCatMention } from '@/components/messaging/insert-cat-mention';

describe('insertCatMention', () => {
  it('prefixes @cat once and fires input', () => {
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    const onInput = vi.fn();
    el.addEventListener('input', onInput);
    el.value = 'what do you think?';
    insertCatMention(el);
    expect(el.value).toBe('@cat what do you think?');
    insertCatMention(el);
    expect(el.value).toBe('@cat what do you think?');
    expect(onInput).toHaveBeenCalledTimes(1);
  });
  it('works on an empty box', () => {
    const el = document.createElement('textarea');
    insertCatMention(el);
    expect(el.value).toBe('@cat ');
  });
});
