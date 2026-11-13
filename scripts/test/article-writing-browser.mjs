import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

const root = process.cwd();
const output = path.resolve(
  process.env.ARTICLE_WRITING_ARTIFACTS ?? 'test-results/article-writing'
);
fs.mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const from = path.join(root, 'src/app/globals.css');
const css = await postcss([tailwind()]).process(fs.readFileSync(from, 'utf8'), { from });
const bundle = await build({
  absWorkingDir: root,
  stdin: {
    resolveDir: root,
    loader: 'jsx',
    contents: `import React from 'react';import{createRoot}from'react-dom/client';
      import ArticleComposer from './src/app/(public)/articles/new/ArticleComposer';
      const root=createRoot(document.getElementById('app'));
      window.published=[];window.paths=[];
      let mountId=0;window.mount=(id='fixture-account-a',prefill,projectParam)=>root.render(<ArticleComposer key={id+':'+mountId++} user={{id}} prefill={prefill} projectParam={projectParam}/>);
      window.mount();`,
  },
  bundle: true,
  write: false,
  outfile: 'article-writing-fixture.js',
  jsx: 'automatic',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'article-runtime-boundaries',
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(next\/(navigation|link|image)|@\/hooks\/useAuth|@\/services\/articles\/(create|update)|@\/services\/images\/upload|@\/services\/timeline\/utils\/post-composer)$/,
          },
          a => ({ path: a.path, namespace: 'boundary' })
        );
        b.onLoad({ filter: /.*/, namespace: 'boundary' }, a => ({
          resolveDir: root,
          loader: 'jsx',
          contents:
            a.path === '@/hooks/useAuth'
              ? 'export const useAuth=()=>({user:{id: "fixture-account-a"}});'
              : a.path === 'next/navigation'
                ? 'export const useRouter=()=>({push:path=>window.paths.push(path)});'
                : a.path === 'next/link'
                  ? 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}'
                  : a.path === 'next/image'
                    ? 'import React from "react";export default function Image(props){return <img {...props}/>}'
                    : a.path.includes('/post-composer')
                      ? 'export const fetchUserProjects=async()=>window.ownProjects??[];'
                      : a.path.includes('/articles/')
                        ? 'export async function publishArticle(user,input){window.published.push({user,input});return {success:true,slug:"fixture-article"}};export const updateArticle=publishArticle;'
                        : 'export const IMAGE_UPLOAD_ACCEPT="image/png,image/jpeg,image/webp,image/gif";export const IMAGE_UPLOAD_FORMATS_LABEL="Images";export const uploadUserImage=async()=>{throw Error("Upload not exercised in this fixture")};',
        }));
        b.onResolve({ filter: /^@\// }, a => {
          const target = path.join(root, 'src', a.path.slice(2));
          const found = ['', '.tsx', '.ts', '.js', '.json', '/index.ts', '/index.tsx']
            .map(ext => target + ext)
            .find(p => fs.existsSync(p) && fs.statSync(p).isFile());
          if (!found) {
            throw Error('Unresolved app fixture import ' + a.path);
          }
          return { path: found };
        });
      },
    },
  ],
});
const code = bundle.outputFiles.find(f => f.path.endsWith('.js') || f.path === '<stdout>').text;
const styles =
  css.css +
  (bundle.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '') +
  `
@font-face{font-family:Inter;src:url('/fonts/inter.woff2');font-weight:100 900}@font-face{font-family:SpaceGrotesk;src:url('/fonts/heading.woff2');font-weight:300 700}
:root{--font-inter:Inter;--font-heading:SpaceGrotesk}body{margin:0}`;
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
  args: ['--no-sandbox'],
});
try {
  for (const width of [320, 390, 834, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      hasTouch: width <= 390,
      isMobile: width <= 390,
    });
    const errors = [];
    page.on('pageerror', e => {
      errors.push(e.message);
      console.error('PAGE ERROR', e.message);
    });
    let held = null;
    await page.route('**/*', async route => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/fonts/inter.woff2' || p === '/fonts/heading.woff2') {
        return route.fulfill({
          contentType: 'font/woff2',
          body: fs.readFileSync(
            path.join(
              root,
              'node_modules/@bitbaum/design-tokens/fonts',
              p.includes('inter')
                ? 'inter/hinted/inter-latin.woff2'
                : 'space-grotesk/hinted/space-grotesk-latin.woff2'
            )
          ),
        });
      }
      if (p === '/api/ai/writing/draft') {
        await new Promise(resolve => {
          held = resolve;
        });
        return route
          .fulfill({
            json: {
              success: true,
              data: {
                draft: {
                  title: 'A generated article',
                  body: 'Generated article body.',
                  excerpt: 'A generated summary.',
                },
              },
            },
          })
          .catch(() => {});
      }
      if (p.startsWith('/api/')) {
        throw Error('Unexpected API request ' + p);
      }
      return route.fulfill({
        contentType: 'text/html',
        body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><div id="app"></div>`,
      });
    });
    await page.goto('http://writing.fixture/articles/new');
    await page.evaluate(() =>
      Object.assign(window, { process: { env: { NODE_ENV: 'production' } } })
    );
    await page.addScriptTag({ content: code });
    const body = page.getByRole('textbox', { name: 'Article body', exact: true });
    const title = page.getByRole('textbox', { name: 'Article title', exact: true });
    await body.waitFor({ timeout: 10000 }).catch(async error => {
      console.error(await page.locator('body').innerText());
      throw error;
    });
    await page.evaluate(() => document.fonts.ready);
    assert.ok((await body.boundingBox()).y < 650, 'editor visible near the top');
    const assertFits = async () => {
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('#app *, [role=dialog], [role=dialog] *')]
          .filter(el => el.getClientRects().length && el.clientWidth > 0 && !el.closest('.sr-only'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            return (
              r.left < -1 ||
              r.right > innerWidth + 1 ||
              (el.tagName !== 'INPUT' && el.scrollWidth > el.clientWidth + 1)
            );
          })
          .map(el => el.tagName + '.' + el.className)
      );
      assert.deepEqual(overflow, [], 'overflow at ' + width);
    };
    const assertTargets = async () => {
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('#app button, [role=dialog] button')]
          .filter(el => el.getClientRects().length)
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.width < 43.9 || r.height < 43.9;
          })
          .map(el => el.getAttribute('aria-label') || el.textContent)
      );
      assert.deepEqual(small, [], 'small targets at ' + width);
    };
    await assertFits();
    await assertTargets();
    await page.getByText('Ask Cat', { exact: true }).click();
    await assertFits();
    await assertTargets();
    await page.getByRole('button', { name: 'Draft article', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Publish', exact: true }).isDisabled(),
      true
    );
    held();
    held = null;
    await title.filter({ visible: true }).waitFor();
    await page.waitForFunction(
      () => document.querySelector('[aria-label="Article title"]').value === 'A generated article'
    );
    assert.equal(await body.inputValue(), 'Generated article body.');
    await page.getByRole('button', { name: 'Undo', exact: true }).waitFor();
    await assertFits();
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await page.getByRole('button', { name: 'New draft', exact: true }).click();
    assert.equal(await body.inputValue(), '');
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).count(), 0);
    await page.getByText('Ask Cat', { exact: true }).click();
    await page.getByRole('button', { name: 'Draft article', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
    held();
    held = null;
    await page.getByRole('button', { name: 'Undo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await body.inputValue(), '');
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await page.getByRole('dialog', { name: 'Your drafts', exact: true }).waitFor();
    await page.getByRole('button', { name: 'New draft', exact: true }).click({ trial: true });
    await assertFits();
    await assertTargets();
    await page.getByRole('button', { name: 'New draft', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).count(), 0);
    assert.equal(await body.inputValue(), '');
    await title.fill('Human article');
    await body.fill('Human writing.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('heading', { name: 'Human article', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    assert.equal(await body.inputValue(), 'Human writing.');
    await assertFits();
    const longTitle = 'A'.repeat(130);
    await title.fill(longTitle);
    const longSource = 'https://example.test/source/' + 'reference'.repeat(30);
    await body.fill(longSource);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('heading', { name: longTitle, exact: true }).waitFor();
    await page
      .getByRole('heading', { name: longTitle, exact: true })
      .locator('..')
      .getByText(longSource, { exact: true })
      .first()
      .waitFor();
    await assertFits();
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await page.getByRole('button', { name: 'New draft', exact: true }).click({ trial: true });
    await assertFits();
    await assertTargets();
    await page.getByRole('button', { name: 'Return to editor', exact: true }).click();
    await title.fill('Human article');
    await body.fill('Human writing.');
    await page.getByText('Draft saved on this device.', { exact: true }).waitFor();
    await page.reload();
    await page.evaluate(() =>
      Object.assign(window, { process: { env: { NODE_ENV: 'production' } } })
    );
    await page.addScriptTag({ content: code });
    await page.waitForFunction(
      () => document.querySelector('[aria-label="Article title"]')?.value === 'Human article'
    );
    assert.equal(await body.inputValue(), 'Human writing.');
    await page.evaluate(() =>
      window.mount('fixture-account-a', {
        title: 'Imported article',
        body: 'Imported source text.',
        host: 'biaslens.orangecat.ch',
      })
    );
    await page.getByText('Brought over from biaslens.orangecat.ch.', { exact: false }).waitFor();
    await page.getByText('Draft saved on this device.', { exact: true }).waitFor();
    assert.equal(await title.inputValue(), 'Imported article');
    assert.equal(await body.inputValue(), 'Imported source text.');
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await page.getByRole('button', { name: /^Human article/ }).waitFor();
    await page.getByRole('button', { name: 'New draft', exact: true }).click();
    assert.equal(await body.inputValue(), '');
    assert.equal(await page.getByText('Brought over from', { exact: false }).count(), 0);
    await page.getByRole('button', { name: 'Drafts', exact: true }).click();
    await page.getByRole('button', { name: /^Human article/ }).click();
    assert.equal(await title.inputValue(), 'Human article');
    assert.equal(await body.inputValue(), 'Human writing.');
    assert.equal(await page.getByText('Brought over from', { exact: false }).count(), 0);
    // "Also post on a project": a link's ?project= preselects the writer's own
    // project; one that is not theirs is not chosen and the editor says so.
    await page.evaluate(() => {
      window.ownProjects = [{ id: 'project-solon', title: 'Solon', status: 'active' }];
      window.mount('fixture-account-a', undefined, 'someone-elses');
    });
    await page.getByText('not one of yours', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Also post on a project', exact: true }).waitFor();
    await page.evaluate(() => window.mount('fixture-account-a', undefined, 'solon'));
    const walls = page.getByRole('button', { name: 'Also posting on Solon', exact: true });
    await walls.waitFor();
    await assertFits();
    await assertTargets();
    await walls.click();
    await page.getByRole('button', { name: 'Deselect Solon', exact: true }).waitFor();
    await assertFits();
    await assertTargets();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await title.fill('Article for Solon');
    await body.fill('Posted on the project too.');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForFunction(() =>
      window.published.some(p => p.input.title === 'Article for Solon')
    );
    assert.deepEqual(
      await page.evaluate(
        () => window.published.find(p => p.input.title === 'Article for Solon').input.projectIds
      ),
      ['project-solon']
    );
    await page.evaluate(() => {
      window.ownProjects = [];
      window.mount('fixture-account-a');
    });
    // No projects, nothing to choose: the control is not there at all.
    await page.getByText('Also post', { exact: false }).waitFor({ state: 'detached' });
    await page.evaluate(() => {
      document.activeElement?.blur();
      scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({ path: path.join(output, `editor-${width}.png`) });
    assert.deepEqual(errors, []);
    process.stdout.write(`PASS actual article editor ${width}\n`);
    await page.close();
  }
} finally {
  await browser.close();
}
