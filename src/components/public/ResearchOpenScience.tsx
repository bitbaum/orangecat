import { ExternalLink, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { OUTPUT_KINDS, RESEARCH_LICENSES } from '@/config/open-science';
import { isContentAddressed, isOpenLicense, outputKindOf } from '@/domain/research/openScience';
import { researchNostrViewUrl, type ResearchForNostr } from '@/domain/research/nostr';
import ResearchNostrPublish from './ResearchNostrPublish';

const KIND_LABELS = Object.fromEntries(OUTPUT_KINDS.map(k => [k.value, k.label]));
const LICENSE_LABELS = Object.fromEntries(RESEARCH_LICENSES.map(l => [l.value, l.label]));

interface ResearchOpenScienceProps {
  researchId: string;
  license?: string | null;
  outputLinks?: string[] | null;
  preregistration?: string | null;
  preregistrationSha256?: string | null;
  preregisteredAt?: string | null;
  nostrPubkey?: string | null;
  nostrPublishedAt?: string | null;
  /** Present only for the researcher: what they would sign, and where it points back to. */
  publish?: { research: ResearchForNostr; pageUrl: string };
}

/**
 * What a backer gets back: the terms, the outputs, and the plan the researcher
 * committed to before seeing results. Every line states its own absence — a
 * missing licence reads "Not stated", never nothing — so a funder can tell an
 * open project from one that simply has not said.
 */
export default function ResearchOpenScience({
  researchId,
  license,
  outputLinks,
  preregistration,
  preregistrationSha256,
  preregisteredAt,
  nostrPubkey,
  nostrPublishedAt,
  publish,
}: ResearchOpenScienceProps) {
  const links = outputLinks ?? [];
  const open = isOpenLicense(license);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Open Science</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-secondary">Licence</span>
          {license ? (
            <Badge variant={open ? 'default' : 'outline'} className="text-right">
              {LICENSE_LABELS[license] ?? license}
            </Badge>
          ) : (
            <span className="text-fg-tertiary">Not stated</span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-fg-secondary">Outputs</p>
          {links.length === 0 ? (
            <p className="text-sm text-fg-tertiary">Nothing published yet.</p>
          ) : (
            <ul className="space-y-2">
              {links.map(link => (
                <li key={link} className="flex min-w-0 items-center gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0">
                    {KIND_LABELS[outputKindOf(link)]}
                  </Badge>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="min-w-0 truncate text-fg-primary underline-offset-2 hover:underline"
                  >
                    {link}
                  </a>
                  {isContentAddressed(link) ? (
                    <span
                      className="shrink-0 text-xs text-fg-tertiary"
                      title="Content-addressed: the link is the hash of the content"
                    >
                      <Lock className="inline h-3 w-3" aria-hidden /> content-addressed
                    </span>
                  ) : (
                    <ExternalLink className="h-3 w-3 shrink-0 text-fg-tertiary" aria-hidden />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-subtle pt-3">
          <p className="text-sm text-fg-secondary">Pre-registration</p>
          {preregistration && preregistrationSha256 && preregisteredAt ? (
            <>
              <p className="whitespace-pre-wrap text-sm text-fg-primary wrap-anywhere">
                {preregistration}
              </p>
              <p className="text-xs text-fg-tertiary wrap-anywhere">
                Committed{' '}
                <time dateTime={preregisteredAt}>
                  {new Date(preregisteredAt).toISOString().slice(0, 10)}
                </time>{' '}
                · cannot be edited · SHA-256{' '}
                <code className="font-mono">{preregistrationSha256}</code>
              </p>
            </>
          ) : (
            <p className="text-sm text-fg-tertiary">
              None — the hypothesis was not committed before results.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-subtle pt-3">
          <p className="text-sm text-fg-secondary">On Nostr</p>
          {nostrPubkey && nostrPublishedAt ? (
            <p className="text-sm text-fg-primary">
              Signed by the researcher&apos;s own key and published{' '}
              <time dateTime={nostrPublishedAt}>{nostrPublishedAt.slice(0, 10)}</time> ·{' '}
              <a
                href={researchNostrViewUrl(researchId, nostrPubkey)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                read it on Nostr
              </a>
            </p>
          ) : (
            <p className="text-sm text-fg-tertiary">
              Not yet — this record lives only on OrangeCat.
            </p>
          )}
          {publish && (
            <ResearchNostrPublish
              research={publish.research}
              pageUrl={publish.pageUrl}
              alreadyPublished={Boolean(nostrPubkey)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
