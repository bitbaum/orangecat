import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

it.each([
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.png?v=new',
  '/favicon.svg',
  '/apple-icon.png',
  '/images/orange-cat-logo.svg',
])('refreshes %s online and retains the cached fallback offline', async path => {
  const old = new Response('old logo');
  const fresh = new Response('new logo');
  const fetch = vi.fn().mockResolvedValue(fresh);
  const put = vi.fn();
  const scope = {
    self: { addEventListener: vi.fn(), location: { origin: 'https://orangecat.ch' } },
    caches: { match: vi.fn().mockResolvedValue(old), open: vi.fn().mockResolvedValue({ put }) },
    fetch,
    URL,
    console: { log: vi.fn() },
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), scope);
  const request = `handleRequest({url: 'https://orangecat.ch${path}', method: 'GET', mode: '${path === '/dashboard' ? 'navigate' : 'cors'}'})`;
  const result = await runInNewContext(request, scope);
  expect(result).toBe(fresh);
  expect(fetch).toHaveBeenCalledOnce();
  expect(put).toHaveBeenCalled();
  fetch.mockRejectedValueOnce(new Error('Offline'));
  expect(await runInNewContext(request, scope)).toBe(old);
});
