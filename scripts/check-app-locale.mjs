#!/usr/bin/env node
/**
 * The interface speaks one language, including its numbers and dates.
 *
 * `toLocaleString()`, `toLocaleDateString()` and `toLocaleTimeString()` with no
 * locale argument use the BROWSER's locale, not the app's. This app ships
 * `<html lang="en">` and no translations, so on a German system a post read
 * "22. Juli" next to a "1d" in the same metadata line, and a character counter
 * read "118 / 5.000" — a thousands separator an English reader parses as five
 * point zero.
 *
 * Eighteen call sites did this. Nobody wrote them wrong on purpose: omitting
 * the locale is the shorter call and it looks right on an English machine,
 * which is every machine the people writing it were using. That is exactly the
 * kind of defect a gate catches and review does not.
 *
 * Use `formatNumber` / `formatDateTime` / `formatClockTime` from
 * `@/utils/locale`, or `formatDate` / `formatTime` from `@/utils/dates`, or
 * pass `APP_LOCALE` explicitly when you need custom options.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/** Defines the rule, so it is allowed to name the methods it forbids. */
const OWNER = 'src/utils/locale.ts';

const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter(f => f !== OWNER);

// toLocaleString() / toLocaleDateString(undefined, …) and friends — an empty
// first argument, or an explicit `undefined` one, both mean "ask the browser".
const BROWSER_LOCALE = /\.toLocale(?:String|DateString|TimeString)\s*\(\s*(?:\)|undefined\b)/;

// A hardcoded tag is the other half of the same rule, and this check used to
// miss it entirely: 25 files pinned their own locale, in TWO dialects, so a
// date read "15 September 2026" on the loan page and "September 15, 2026"
// everywhere else. Passing 'en-US' also silently ignores APP_LOCALE, so the
// day it changes those files keep the old one.
const PINNED_LOCALE =
  /(?:\.toLocale(?:String|DateString|TimeString)|Intl\.(?:NumberFormat|DateTimeFormat|RelativeTimeFormat|ListFormat))\s*\(\s*'[a-z]{2}(?:-[A-Za-z0-9]+)*'/;

const OFFENDING = new RegExp(`${BROWSER_LOCALE.source}|${PINNED_LOCALE.source}`);

const hits = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) {
      return; // a comment describing the rule is not a violation of it
    }
    if (OFFENDING.test(line)) {
      hits.push({ file, line: i + 1, text: line.trim().slice(0, 100) });
    }
  });
}

if (hits.length > 0) {
  console.error('✗ Formatting with the BROWSER locale instead of the app locale:');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    ${h.text}`);
  }
  console.error('');
  console.error('The app ships <html lang="en"> and no translations, so these render');
  console.error('German dates and separators to anyone on a non-English system.');
  console.error('');
  console.error('  numbers        formatNumber(n)         from @/utils/locale');
  console.error('  date + time    formatDateTime(v)       from @/utils/locale');
  console.error('  clock time     formatClockTime(v)      from @/utils/locale');
  console.error('  date only      formatDate(v)           from @/utils/dates');
  console.error('  custom options pass APP_LOCALE explicitly, never undefined');
  process.exit(1);
}

console.log(`check:app-locale passed — ${files.length} files, no browser-locale formatting`);
