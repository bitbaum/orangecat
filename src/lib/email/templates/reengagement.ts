/**
 * Re-engagement Email Template
 *
 * Parameterized by dormancy stage (14d, 30d, 60d, 90d).
 * Gentle, Cat-voiced nudges that respect the user's autonomy.
 * Pure functions — no imports from outside templates.
 */

import { emailLayout, emailPlainText, escapeHtml, EMAIL_COLORS } from './layout';

export type ReengagementStage = '14d' | '30d' | '60d' | '90d';

interface ReengagementEmailData {
  displayName: string;
  stage: ReengagementStage;
  /** Entity title for the 14d and 60d variants */
  entityTitle?: string;
  /** Recent view count for the 14d variant */
  recentViews?: number;
  dashboardUrl: string;
  entityUrl?: string;
  exploreUrl: string;
  unsubscribeUrl: string;
}

interface ReengagementConfig {
  subject: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  ctaText: string;
  ctaUrl: string;
  preheader: string;
}

function getReengagementConfig(data: ReengagementEmailData): ReengagementConfig {
  const { displayName, stage, entityTitle, recentViews, dashboardUrl, entityUrl, exploreUrl } =
    data;
  const greeting = displayName !== 'there' ? displayName : 'there';
  const entityLabel = entityTitle || 'your listing';

  switch (stage) {
    case '14d':
      return {
        subject: `Your ${entityLabel} is still getting views`,
        heading: 'People are still looking',
        preheader: `${entityLabel} got ${recentViews || 'some'} views while you were away.`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            Just a quick note — <strong>${escapeHtml(entityLabel)}</strong> got
            ${recentViews ? `<strong>${recentViews}</strong> views` : 'some views'}
            recently, even without you doing anything.
          </p>
          <p style="margin:0 0 16px;">
            That means people are finding it. A small update — a better description,
            a new photo, or a price tweak — could make a real difference.
          </p>
          <p style="margin:0;">No pressure. Just thought you'd want to know.</p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          `${entityLabel} got ${recentViews || 'some'} views recently.`,
          '',
          'A small update could make a real difference.',
          "No pressure. Just thought you'd want to know.",
        ].join('\n'),
        ctaText: 'View your listing',
        ctaUrl: entityUrl || dashboardUrl,
      };

    case '30d':
      return {
        subject: 'Things are happening on OrangeCat',
        heading: "Here's what's new",
        preheader: 'Some things happened on OrangeCat while you were away.',
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            It's been a little while. OrangeCat keeps growing —
            new people, new listings, new projects getting funded.
          </p>
          <p style="margin:0 0 16px;">
            If you've been thinking about creating or updating something,
            now is a good time. The community is active.
          </p>
          <p style="margin:0;">I'm here if you need a hand with anything.</p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          "It's been a little while. OrangeCat keeps growing —",
          'new people, new listings, new projects getting funded.',
          '',
          "If you've been thinking about creating or updating something,",
          'now is a good time.',
          '',
          "I'm here if you need a hand with anything.",
        ].join('\n'),
        ctaText: "See what's new",
        ctaUrl: exploreUrl,
      };

    case '60d':
      return {
        subject: `Want me to help refresh ${entityLabel}?`,
        heading: 'Need a refresh?',
        preheader: `I can help you update ${entityLabel} if you'd like.`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            It's been about two months since you last updated
            <strong>${escapeHtml(entityLabel)}</strong>.
          </p>
          <p style="margin:0 0 16px;">
            Listings that get periodic updates tend to get more visibility.
            I can help you rewrite descriptions, suggest better pricing,
            or update details — just open a chat with me.
          </p>
          <p style="margin:0;">Or if you'd rather archive it, that's fine too. Your call.</p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          `It's been about two months since you last updated ${entityLabel}.`,
          '',
          'Listings that get periodic updates tend to get more visibility.',
          'I can help you refresh it — just open a chat with me.',
          '',
          "Or if you'd rather archive it, that's fine too.",
        ].join('\n'),
        ctaText: 'Update your listing',
        ctaUrl: entityUrl || dashboardUrl,
      };

    case '90d':
      return {
        subject: "I'm still here if you need me",
        heading: 'Checking in',
        preheader: "No pressure — just wanted you to know I'm still around.",
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            It's been a while. No agenda here — just wanted you to know
            your account and everything you've created is still here,
            exactly as you left it.
          </p>
          <p style="margin:0 0 16px;">
            If you ever want to pick things up again, just sign in.
            I'll be here.
          </p>
          <p style="margin:0;color:${EMAIL_COLORS.TEXT_MUTED};font-size:14px;">
            If you're done with OrangeCat, you can unsubscribe below
            and I won't email you again.
          </p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          "It's been a while. No agenda — just wanted you to know",
          "your account and everything you've created is still here.",
          '',
          'If you ever want to pick things up again, just sign in.',
          "I'll be here.",
          '',
          "If you're done, you can unsubscribe and I won't email you again.",
        ].join('\n'),
        ctaText: 'Visit OrangeCat',
        ctaUrl: dashboardUrl,
      };
  }
}

export function reengagementTemplate(data: ReengagementEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const config = getReengagementConfig(data);

  const html = emailLayout({
    preheader: config.preheader,
    heading: config.heading,
    body: config.bodyHtml,
    ctaText: config.ctaText,
    ctaUrl: config.ctaUrl,
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = emailPlainText({
    heading: config.heading,
    body: config.bodyText,
    ctaText: config.ctaText,
    ctaUrl: config.ctaUrl,
    unsubscribeUrl: data.unsubscribeUrl,
  });

  return { subject: config.subject, html, text };
}
