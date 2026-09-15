/**
 * Group Activity Email Template
 *
 * Parameterized by activity type: invite, proposal, vote_reminder, proposal_resolved.
 * Pure functions — no imports from outside templates.
 */

import { emailLayout, emailPlainText, escapeHtml, EMAIL_COLORS } from './layout';

export type GroupActivityType = 'invite' | 'proposal' | 'vote_reminder' | 'proposal_resolved';

interface GroupActivityEmailData {
  displayName: string;
  activityType: GroupActivityType;
  groupName: string;
  groupUrl: string;
  /** For invite: who invited them */
  invitedBy?: string;
  /** For proposal / vote_reminder / proposal_resolved */
  proposalTitle?: string;
  proposalUrl?: string;
  /** For vote_reminder: when voting ends */
  votingEnds?: string;
  /** For proposal_resolved: outcome */
  outcome?: 'passed' | 'failed';
  /** For proposal_resolved: vote counts */
  votesFor?: number;
  votesAgainst?: number;
  unsubscribeUrl: string;
}

interface GroupActivityConfig {
  subject: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  ctaText: string;
  ctaUrl: string;
  preheader: string;
}

function getGroupActivityConfig(data: GroupActivityEmailData): GroupActivityConfig {
  const {
    displayName,
    activityType,
    groupName,
    groupUrl,
    invitedBy,
    proposalTitle,
    proposalUrl,
    votingEnds,
    outcome,
    votesFor,
    votesAgainst,
  } = data;
  const greeting = displayName !== 'there' ? displayName : 'there';
  const pUrl = proposalUrl || groupUrl;

  switch (activityType) {
    case 'invite':
      return {
        subject: `You're invited to join ${groupName}`,
        heading: `Join ${groupName}?`,
        preheader: `${invitedBy || 'Someone'} invited you to ${groupName} on OrangeCat.`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            <strong>${invitedBy || 'Someone'}</strong> invited you to join
            <strong>${escapeHtml(groupName)}</strong> on OrangeCat.
          </p>
          <p style="margin:0 0 16px;">
            Groups on OrangeCat can share wallets, create listings together,
            and make collective decisions through proposals and voting.
          </p>
          <p style="margin:0;">Take a look and decide if it's for you.</p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          `${invitedBy || 'Someone'} invited you to join ${groupName} on OrangeCat.`,
          '',
          'Groups can share wallets, create listings together,',
          'and make decisions through proposals and voting.',
          '',
          "Take a look and decide if it's for you.",
        ].join('\n'),
        ctaText: 'View invitation',
        ctaUrl: groupUrl,
      };

    case 'proposal':
      return {
        subject: `${groupName}: New proposal needs your vote`,
        heading: 'New proposal',
        preheader: `"${proposalTitle || 'A new proposal'}" in ${groupName} needs your vote.`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            A new proposal was created in <strong>${escapeHtml(groupName)}</strong>:
          </p>
          <div style="padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid ${EMAIL_COLORS.TIFFANY};margin:0 0 16px;">
            <p style="margin:0;font-size:16px;font-weight:600;">${escapeHtml(proposalTitle || 'Untitled proposal')}</p>
          </div>
          <p style="margin:0;">Your vote matters. Take a look when you can.</p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          `A new proposal was created in ${groupName}:`,
          '',
          `  "${proposalTitle || 'Untitled proposal'}"`,
          '',
          'Your vote matters. Take a look when you can.',
        ].join('\n'),
        ctaText: 'Review proposal',
        ctaUrl: pUrl,
      };

    case 'vote_reminder':
      return {
        subject: `${groupName}: Voting ends tomorrow`,
        heading: 'Voting ends soon',
        preheader: `"${proposalTitle || 'A proposal'}" in ${groupName} closes ${votingEnds || 'tomorrow'}.`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            The vote on this proposal in <strong>${escapeHtml(groupName)}</strong> ends
            <strong>${escapeHtml(votingEnds || 'tomorrow')}</strong>:
          </p>
          <div style="padding:16px;background:#fff7ed;border-radius:8px;border-left:4px solid #f59e0b;margin:0 0 16px;">
            <p style="margin:0;font-size:16px;font-weight:600;">${escapeHtml(proposalTitle || 'Untitled proposal')}</p>
          </div>
          <p style="margin:0;">If you haven't voted yet, now's the time.</p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          `The vote on this proposal in ${groupName} ends ${votingEnds || 'tomorrow'}:`,
          '',
          `  "${proposalTitle || 'Untitled proposal'}"`,
          '',
          "If you haven't voted yet, now's the time.",
        ].join('\n'),
        ctaText: 'Cast your vote',
        ctaUrl: pUrl,
      };

    case 'proposal_resolved': {
      const passed = outcome === 'passed';
      const outcomeLabel = passed ? 'passed' : 'did not pass';
      const voteInfo =
        votesFor !== undefined && votesAgainst !== undefined
          ? ` (${votesFor} for, ${votesAgainst} against)`
          : '';

      return {
        subject: `${groupName}: "${proposalTitle || 'Proposal'}" ${outcomeLabel}`,
        heading: `Proposal ${outcomeLabel}`,
        preheader: `"${proposalTitle || 'A proposal'}" in ${groupName} has ${outcomeLabel}${voteInfo}.`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${greeting},</p>
          <p style="margin:0 0 16px;">
            The vote is in for <strong>${escapeHtml(groupName)}</strong>.
          </p>
          <div style="padding:16px;background:${passed ? '#f0fdf4' : '#fef2f2'};border-radius:8px;border-left:4px solid ${passed ? '#22c55e' : '#ef4444'};margin:0 0 16px;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:600;">
              ${escapeHtml(proposalTitle || 'Untitled proposal')}
            </p>
            <p style="margin:0;font-size:14px;color:${EMAIL_COLORS.TEXT_SECONDARY};">
              ${passed ? 'Passed' : 'Did not pass'}${voteInfo}
            </p>
          </div>
          <p style="margin:0;">See the full results and next steps in the group.</p>`,
        bodyText: [
          `Hi ${greeting},`,
          '',
          `The vote is in for ${groupName}.`,
          '',
          `  "${proposalTitle || 'Untitled proposal'}" — ${outcomeLabel}${voteInfo}`,
          '',
          'See the full results and next steps in the group.',
        ].join('\n'),
        ctaText: 'View results',
        ctaUrl: pUrl,
      };
    }
  }
}

export function groupActivityTemplate(data: GroupActivityEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const config = getGroupActivityConfig(data);

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
