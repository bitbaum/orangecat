import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('username-only public profile links', () => {
  it.each([
    'src/components/timeline/PostHeader.tsx',
    'src/components/timeline/PostContent.tsx',
    'src/components/timeline/RepostModal.tsx',
    'src/services/timeline/processors/enrichment.ts',
    'src/components/dashboard/sections/DashboardInviteCTA.tsx',
    'src/components/messaging/MessageView/MessageHeader.tsx',
    'src/components/messaging/ConversationListItem.tsx',
    'src/features/messaging/lib/message-utils.ts',
    'src/app/(public)/articles/[slug]/page.tsx',
  ])('%s delegates optional public profile paths to the canonical helper', relativePath => {
    expect(source(relativePath)).toContain('optionalPublicProfilePath');
  });

  it('keeps UUID fallbacks out of public profile URLs in application source', () => {
    const offenders: string[] = [];
    const preEncodedBuilderCalls: string[] = [];
    const srcRoot = path.join(ROOT, 'src');

    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(absolute);
        } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
          const text = fs.readFileSync(absolute, 'utf8');
          if (
            /\/profiles\/\$\{[^}]*\b(?:user_?id|userId|actor_?id|actorId|\.id)\b[^}]*\}/i.test(text)
          ) {
            offenders.push(path.relative(ROOT, absolute));
          }
          if (/ROUTES\.PROFILES\.VIEW\(\s*encodeURIComponent\(/.test(text)) {
            preEncodedBuilderCalls.push(path.relative(ROOT, absolute));
          }
          if (/publicProfilePath\(\s*(?:encodeURIComponent\(|(?:safe|encoded)Username\b)/.test(text)) {
            preEncodedBuilderCalls.push(path.relative(ROOT, absolute));
          }
          const runtimeProfileInterpolation = text.match(/(?<!\/api)\/profiles\/\$\{/g);
          if (
            runtimeProfileInterpolation &&
            path.relative(ROOT, absolute) !== 'src/config/public-profile-path.ts'
          ) {
            offenders.push(path.relative(ROOT, absolute));
          }
        }
      }
    };

    visit(srcRoot);
    expect(offenders).toEqual([]);
    expect(preEncodedBuilderCalls).toEqual([]);
  });
});
