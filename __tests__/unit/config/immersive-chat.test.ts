import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMMERSIVE_CHAT_ATTR } from '@/config/layout-chrome';

/**
 * An open bot chat on /companions/talk owns the phone screen, as the Cat hub
 * does: the path alone cannot say a chat is open (`?with=`), so the open
 * conversation carries IMMERSIVE_CHAT_ATTR and globals.css hides the app
 * header below md while it is on the page. Three files hold one contract;
 * this keeps them saying the same name. Checked in a browser on 2026-11-01:
 * 390px, the chat runs 0–780 with no header; 800 and 1280 keep the header.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('a chat that owns the phone', () => {
  const css = read('src/app/globals.css');

  it('hides the app header, clears its offset and takes the viewport while one is open', () => {
    const phone = css.slice(css.indexOf('A chat that owns the phone'));
    expect(phone).toContain(`body:has([${IMMERSIVE_CHAT_ATTR}]) .app-header`);
    expect(phone).toContain(`.app-header-offset:has([${IMMERSIVE_CHAT_ATTR}])`);
    expect(phone).toContain(`.app-content-height:has([${IMMERSIVE_CHAT_ATTR}])`);
    // Only on a phone: from md the shell, header included, stays.
    expect(phone.indexOf('@media (max-width: 767px)')).toBeLessThan(
      phone.indexOf(`body:has([${IMMERSIVE_CHAT_ATTR}])`)
    );
  });

  it('the header is the element the rule names', () => {
    expect(read('src/components/layout/Header.tsx')).toMatch(/className=\{`app-header /);
  });

  it('the talk home marks the open conversation, and only that', () => {
    expect(read('src/components/companions/talk/TalkHome.tsx')).toContain(
      "{...(conversation ? { [IMMERSIVE_CHAT_ATTR]: '' } : {})}"
    );
  });
});
