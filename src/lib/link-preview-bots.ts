/**
 * Is this request a messenger building a link preview, rather than a person?
 *
 * Pasting a link into WhatsApp, Telegram, Slack, iMessage, Signal, LinkedIn or
 * an email client makes that app fetch the page to draw its card — before the
 * recipient has seen anything. Anything that counts "opened" (an investor room,
 * a profile claim) must not count those, or the owner is told "Anna opened it"
 * the moment they hit send.
 *
 * Matched on the User-Agent, which these fetchers set honestly: being
 * recognised is how they get the preview metadata. A missing User-Agent is
 * treated as a machine too — every browser sends one.
 */

const PREVIEW_AGENTS = [
  'whatsapp',
  'telegrambot',
  'slackbot',
  'slack-imgproxy',
  'facebookexternalhit',
  'facebookcatalog',
  'meta-externalagent',
  'twitterbot',
  'linkedinbot',
  'discordbot',
  'skypeuripreview',
  'microsoftpreview',
  'teamsbot',
  'googlebot',
  'google-inspectiontool',
  'googleother',
  'bingbot',
  'bingpreview',
  'applebot',
  'pinterestbot',
  'redditbot',
  'embedly',
  'iframely',
  'mastodon',
  'bluesky',
  'signal',
  'vkshare',
  'yandex',
  'duckduckbot',
  'baiduspider',
  'petalbot',
  'curl/',
  'wget/',
  'python-requests',
  'go-http-client',
  'node-fetch',
  'undici',
  'headlesschrome',
];

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) {
    return true;
  }
  const ua = userAgent.toLowerCase();
  return PREVIEW_AGENTS.some(agent => ua.includes(agent)) || /\bbot\b|crawler|spider/.test(ua);
}
