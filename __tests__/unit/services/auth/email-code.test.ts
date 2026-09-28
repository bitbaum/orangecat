import { vi } from 'vitest';
import { normalizeEmail, sendSignInCode, type EmailCodeDeps } from '@/services/auth/emailCode';
import { signInCodeTemplate } from '@/lib/email/templates/sign-in-code';

function deps(overrides: Partial<EmailCodeDeps> = {}) {
  const sent: Array<{ to: string | string[]; subject: string; text?: string; html?: string }> = [];
  const d: EmailCodeDeps = {
    isEmailConfigured: () => true,
    generateCode: vi.fn(async () => '482913'),
    sendEmail: vi.fn(async message => {
      sent.push(message);
      return { sent: true } as never;
    }),
    ...overrides,
  };
  return { d, sent };
}

describe('sendSignInCode', () => {
  it('generates a code and mails it to the normalized address', async () => {
    const { d, sent } = deps();
    await expect(sendSignInCode({ email: '  Ana@Example.org ' }, d)).resolves.toEqual({
      status: 'sent',
    });
    expect(d.generateCode).toHaveBeenCalledWith('ana@example.org');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ana@example.org');
    expect(sent[0].subject).toContain('482913');
    expect(sent[0].text).toContain('482913');
  });

  it('is unavailable, and generates nothing, where email cannot be sent', async () => {
    const { d } = deps({ isEmailConfigured: () => false });
    await expect(sendSignInCode({ email: 'ana@example.org' }, d)).resolves.toEqual({
      status: 'unavailable',
    });
    expect(d.generateCode).not.toHaveBeenCalled();
  });

  it('refuses an address that is not one, before touching the auth server', async () => {
    const { d } = deps();
    for (const email of ['', 'no-at-sign', 'a@b', 42, null, 'x@y.z<script>']) {
      await expect(sendSignInCode({ email }, d)).resolves.toMatchObject({ status: 'invalid' });
    }
    expect(d.generateCode).not.toHaveBeenCalled();
  });

  it('reports one generic failure whether GoTrue refused, threw, or the mail bounced', async () => {
    const refused = deps({ generateCode: async () => null });
    const threw = deps({
      generateCode: async () => {
        throw new Error('boom');
      },
    });
    const bounced = deps({ sendEmail: async () => ({ sent: false }) as never });
    for (const { d } of [refused, threw, bounced]) {
      await expect(sendSignInCode({ email: 'ana@example.org' }, d)).resolves.toEqual({
        status: 'failed',
      });
    }
  });

  it('never mails something that is not a numeric code', async () => {
    const { d, sent } = deps({ generateCode: async () => 'not-a-code' });
    await expect(sendSignInCode({ email: 'ana@example.org' }, d)).resolves.toEqual({
      status: 'failed',
    });
    expect(sent).toHaveLength(0);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases, so rate limits cannot be dodged by case', () => {
    expect(normalizeEmail(' Ana@EXAMPLE.org')).toBe('ana@example.org');
  });
});

describe('signInCodeTemplate', () => {
  it('puts the code in the subject, both bodies, and names the app that asked', () => {
    const { subject, html, text } = signInCodeTemplate({ code: '482913', appName: 'Solon' });
    expect(subject).toBe('482913 is your sign-in code');
    expect(html).toContain('482913');
    expect(text).toContain('482913');
    expect(text).toContain('Solon (your OrangeCat account)');
  });

  it('carries no link to click and no unsubscribe footer', () => {
    const { html, text } = signInCodeTemplate({ code: '482913' });
    expect(html).not.toMatch(/Unsubscribe/i);
    expect(text).not.toMatch(/Unsubscribe/i);
    // The only links are the brand footer's; no sign-in link exists to phish with.
    expect(html.match(/href="/g)?.length ?? 0).toBe(1);
  });

  it('escapes an app name rather than rendering it as markup', () => {
    const { html } = signInCodeTemplate({ code: '482913', appName: '<b>x</b>' });
    expect(html).not.toContain('<b>x</b>');
  });

  it('promises no expiry window the server may not keep', () => {
    const { text } = signInCodeTemplate({ code: '482913' });
    expect(text).not.toMatch(/\d+\s*minutes?/);
  });
});
