/**
 * Per-section renderers for the Cat user-context string. Each returns a `## …`
 * markdown block (or null when it has nothing to show). buildFullContextString
 * composes them in priority order, then budgets + wraps. Extracted from
 * context-string-builder.ts purely for SoC — output is byte-identical (guarded by
 * context-string-builder.snapshot.test.ts), so keep wording/format changes here.
 */
import type { DocumentContext, EntitySummary, FullUserContext } from './document-context-types';
import { ENTITY_STATUS } from '@/config/database-constants';
import { renderLightningAddressProviders } from '@/config/wallet-providers';
import { economicProfileGaps, economicCompleteness } from '@/services/cat/economic-profile';
import { APP_LOCALE } from '@/utils/locale';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  goals: 'Goals & Aspirations',
  skills: 'Skills & Expertise',
  finances: 'Financial Information',
  business_plan: 'Business Plans',
  background: 'Background & History',
  preferences: 'Preferences & Values',
  plans: 'Plans & Projects',
  notes: 'Notes & Ideas',
  other: 'Other Context',
};

function buildDocumentContextString(documents: DocumentContext[]): string {
  if (documents.length === 0) {
    return '';
  }

  const sections: string[] = [];

  const byType = documents.reduce(
    (acc, doc) => {
      const type = doc.document_type || 'other';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(doc);
      return acc;
    },
    {} as Record<string, DocumentContext[]>
  );

  for (const [type, docs] of Object.entries(byType)) {
    const label = DOCUMENT_TYPE_LABELS[type] || type;
    const docContents = docs
      .map(doc => {
        const content =
          doc.content.length > 1500 ? doc.content.substring(0, 1500) + '...' : doc.content;
        return `**${doc.title}**:\n${content}`;
      })
      .join('\n\n');

    sections.push(`### ${label}\n${docContents}`);
  }

  return `## Personal Context (from user's My Context documents)

The user has shared the following context to help you provide personalized advice:

${sections.join('\n\n')}

---
Use this context to personalize your responses. Reference their goals, skills, and situation when relevant. If they ask about something related to their context, use this information.`;
}

export function renderCurrentSession(r: FullUserContext['runtime']): string | null {
  if (!r) {
    return null;
  }
  const lines: string[] = [];
  if (r.currentActor) {
    const actorLabel =
      r.currentActor.type === 'individual'
        ? `**Acting as**: yourself${r.currentActor.name ? ` (${r.currentActor.name})` : ''}`
        : `**Acting as**: group "${r.currentActor.name ?? 'unnamed'}" (you have permission to act on this group's behalf)`;
    lines.push(actorLabel);
  }
  lines.push(
    `**Display currency**: ${r.preferredCurrency} — quote prices in this currency by default; convert to/from BTC as needed.`
  );
  if (r.btcRate) {
    lines.push(
      `**Live BTC price**: 1 BTC ≈ ${Math.round(r.btcRate.rate).toLocaleString(APP_LOCALE)} ${r.btcRate.currency} right now — use THIS rate for every BTC⇄fiat conversion. Never recall or guess a rate.`
    );
  } else {
    lines.push(
      `**Live BTC price**: unavailable this turn — do NOT guess a BTC⇄fiat rate; say you can't quote an exact conversion right now.`
    );
  }
  lines.push(
    `**Locale**: ${r.locale} — reply in the language and conventions of this locale unless the user writes in another language.`
  );
  if (r.currentPath) {
    const entity = r.currentEntity
      ? ` — a ${r.currentEntity.type} (ref \`${r.currentEntity.ref}\`)`
      : '';
    lines.push(
      `**Currently viewing**: \`${r.currentPath}\`${entity}. The user opened you WHILE on this page — if their question is about it ("this", "here", "them"), ground your answer in it.${r.currentEntity ? ` Use your lookup/search tools to pull the specifics of that ${r.currentEntity.type} rather than guessing.` : ''}`
    );
    if (r.pageExcerpt) {
      lines.push(
        `**Visible on this page right now** (verbatim excerpt of what the user sees):\n"""\n${r.pageExcerpt}\n"""\nWhen explaining or helping with this page, describe ONLY sections and controls that appear in this excerpt — never invent ones that don't. If something the user asks about isn't in the excerpt, say you don't see it on this page.`
      );
    } else if (!r.currentEntity) {
      lines.push(
        `You can NOT see this page's contents. If the user asks about "this page", say what you can't see and ask them to describe or paste the part they mean — do not guess at sections or controls.`
      );
    }
  } else if (r.lastVisitedPath) {
    lines.push(
      `**Just came from**: \`${r.lastVisitedPath}\` — if relevant to their question, reference what's on that page.`
    );
  }
  return `## Current Session\n${lines.join('\n')}`;
}

export function renderMemories(memories: FullUserContext['memories']): string | null {
  if (!memories || memories.length === 0) {
    return null;
  }
  const memoryLines = memories.map(m => `- ${m.content}`);
  return `## What you remember about this user\nThese are durable facts you've learned about them across past conversations. Treat them as known and use them naturally — don't re-ask what you already know.\n${memoryLines.join('\n')}`;
}

export function renderDateTime(locale: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const timeStr = now.toISOString().slice(11, 16);
  return `## Current Date & Time\nToday is ${dateStr}, ${timeStr} UTC.`;
}

export function renderProfile(p: FullUserContext['profile']): string | null {
  if (!p) {
    return null;
  }
  const profileParts: string[] = [];

  if (p.name) {
    profileParts.push(`**Name**: ${p.name}`);
  }
  if (p.username) {
    profileParts.push(`**Username**: @${p.username}`);
  }
  if (p.bio) {
    profileParts.push(`**Bio**: ${p.bio}`);
  }
  if (p.location_city || p.location_country) {
    profileParts.push(
      `**Location**: ${[p.location_city, p.location_country].filter(Boolean).join(', ')}`
    );
  }
  if (p.background) {
    profileParts.push(`**Background**: ${p.background}`);
  }
  if (p.website) {
    profileParts.push(`**Website**: ${p.website}`);
  }

  if (profileParts.length === 0) {
    return null;
  }
  return `## User Profile\n${profileParts.join('\n')}`;
}

/**
 * The structured economic profile — what this person can offer, plus what's still
 * unknown (which drives the proactive interview). Returns null only when the field
 * was never provided (e.g. non-chat contexts / snapshot), so it's snapshot-neutral;
 * for a real user it always renders — either what we know, an invitation to draw
 * out what we don't, or both.
 */
export function renderEconomicProfile(ep: FullUserContext['economicProfile']): string | null {
  if (ep === undefined) {
    return null;
  }
  const parts: string[] = [];
  if (ep) {
    if (ep.skills.length) {
      parts.push(
        `**Skills**: ${ep.skills.map(s => (s.level ? `${s.name} (${s.level})` : s.name)).join(', ')}`
      );
    }
    if (ep.askedFor.length) {
      parts.push(`**People come to them for**: ${ep.askedFor.join('; ')}`);
    }
    if (ep.assets.length) {
      parts.push(`**Assets**: ${ep.assets.map(a => a.name).join(', ')}`);
    }
    if (ep.notAvailableFor.length) {
      parts.push(`**Not currently taking on (public)**: ${ep.notAvailableFor.join('; ')}`);
    }
    if (ep.goals.length) {
      parts.push(
        `**Goals**: ${ep.goals.map(g => (g.kind ? `${g.text} [${g.kind}]` : g.text)).join('; ')}`
      );
    }
    if (ep.constraints.length) {
      parts.push(`**Constraints**: ${ep.constraints.join('; ')}`);
    }
    if (ep.motivation) {
      parts.push(`**Here for**: ${ep.motivation}`);
    }
    if (ep.stage) {
      parts.push(`**Stage**: ${ep.stage}`);
    }
  }

  // What's still unknown drives the interview: tell Cat exactly what to draw out.
  const pct = economicCompleteness(ep ?? null);
  const gaps = economicProfileGaps(ep ?? null);
  if (gaps.length) {
    parts.push(
      parts.length
        ? `_Economic picture ~${pct}% complete — still unknown: ${gaps.join(', ')}. When it fits, draw these out ONE at a time (see "Drawing out what they can offer"). You can frame it for them: "you're most of the way to a full picture."_`
        : `_Economic picture 0% — nothing captured yet. When it fits naturally, surface their latent value with ONE story-based question (see "Drawing out what they can offer") — start with what people come to them for._`
    );
  } else {
    parts.push(
      `_Economic picture ~${pct}% complete — you have a full picture; focus on turning it into offers and next steps, not more discovery questions._`
    );
  }

  if (parts.length === 0) {
    return null;
  }
  return `## Economic Profile (what they can offer)\n${parts.join('\n')}`;
}

export function renderDocuments(documents: DocumentContext[]): string | null {
  if (documents.length === 0) {
    return null;
  }
  return buildDocumentContextString(documents) || null;
}

export function renderEntities(entities: EntitySummary[]): string | null {
  if (entities.length === 0) {
    return null;
  }
  const entityGroups: Record<string, EntitySummary[]> = {};
  entities.forEach(e => {
    if (!entityGroups[e.type]) {
      entityGroups[e.type] = [];
    }
    entityGroups[e.type].push(e);
  });

  const entityParts: string[] = [];

  const typeLabels: Record<string, string> = {
    product: 'Products',
    service: 'Services',
    project: 'Projects',
    cause: 'Causes',
    event: 'Events',
    asset: 'Assets',
    loan: 'Loans',
    investment: 'Investments',
    research: 'Research',
    wishlist: 'Wishlists',
  };

  for (const [type, items] of Object.entries(entityGroups)) {
    const label = typeLabels[type] || type;
    const itemList = items
      .map(item => {
        const parts = [`- **${item.title}**`];
        if (item.status !== ENTITY_STATUS.ACTIVE) {
          parts.push(` [${item.status}]`);
        }
        if (item.price_btc) {
          parts.push(` (${item.price_btc} BTC)`);
        }
        if (item.category) {
          parts.push(` [${item.category}]`);
        }
        if (item.location) {
          parts.push(` @ ${item.location}`);
        }
        // Show funding received where known (projects, research, causes)
        if (item.raised_btc !== undefined && item.raised_btc > 0) {
          const supporterNote = item.num_supporters
            ? ` from ${item.num_supporters} supporter${item.num_supporters !== 1 ? 's' : ''}`
            : '';
          parts.push(` — raised ${item.raised_btc} BTC${supporterNote}`);
        }
        if (item.description) {
          parts.push(`: ${item.description}`);
        }
        parts.push(` (id: ${item.id})`);
        return parts.join('');
      })
      .join('\n');
    entityParts.push(`### ${label}\n${itemList}`);
  }

  if (entityParts.length === 0) {
    return null;
  }
  return `## User's OrangeCat Entities\n\nThe user has created the following on OrangeCat:\n\n${entityParts.join('\n\n')}`;
}

export function renderGroupMemberships(
  memberGroups: FullUserContext['memberGroups']
): string | null {
  if (memberGroups.length === 0) {
    return null;
  }
  const groupLines = memberGroups.map(g => {
    const parts = [`- **${g.name}**`];
    if (g.label) {
      parts.push(` [${g.label}]`);
    }
    parts.push(` — role: ${g.role}`);
    if (g.visibility !== 'public') {
      parts.push(` (${g.visibility})`);
    }
    if (g.description) {
      parts.push(`: ${g.description.substring(0, 200)}`);
    }
    // Include group ID so Cat can reference it in invite_to_organization exec_action
    parts.push(` (id: ${g.id})`);
    return parts.join('');
  });
  return `## Group Memberships\nThe user is a member of the following groups:\n${groupLines.join('\n')}`;
}

export function renderSocialGraph(sg: FullUserContext['socialGraph']): string | null {
  if (!sg || !(sg.followers > 0 || sg.following > 0)) {
    return null;
  }
  const lines = [`- ${sg.followers} follower(s), following ${sg.following} account(s)`];
  if (sg.recentFollowing.length > 0) {
    const handles = sg.recentFollowing
      .map(p => (p.username ? `@${p.username}` : p.name || 'unknown'))
      .join(', ');
    lines.push(`- Recently followed: ${handles}`);
  }
  return `## Social Graph\n${lines.join('\n')}`;
}

export function renderProjectActivity(
  projectActivity: FullUserContext['projectActivity']
): string | null {
  if (!projectActivity || projectActivity.length === 0) {
    return null;
  }
  const lines = projectActivity.map(e => {
    const tag = e.source === 'loki' ? ' [via Loki]' : '';
    const when = e.at ? ` (${e.at.slice(0, 10)})` : '';
    const desc = e.description ? ` — ${e.description.slice(0, 140)}` : '';
    return `- **${e.title}**${tag}${when}${desc}`;
  });
  return `## Recent Project Activity\nUpdates on the user's projects (Loki build updates are tagged):\n${lines.join('\n')}`;
}

export function renderStakeholders(stakeholders: FullUserContext['stakeholders']): string | null {
  if (!stakeholders || stakeholders.length === 0) {
    return null;
  }
  const byKind = new Map<string, string[]>();
  for (const s of stakeholders) {
    const list = byKind.get(s.kind) ?? [];
    list.push(s.counterparty);
    byKind.set(s.kind, list);
  }
  const lines = Array.from(byKind.entries()).map(
    ([kind, parties]) => `- ${kind}: ${parties.join(', ')}`
  );
  return `## Stakeholders\nTyped relationships on the user's projects (e.g. customers):\n${lines.join('\n')}`;
}

/**
 * What Loki is doing with this person's projects. Only the state that changes
 * what Cat says: live or not, blocked on them, working, and feedback waiting.
 */
export function renderLokiProjects(lokiProjects: FullUserContext['lokiProjects']): string | null {
  if (!lokiProjects || lokiProjects.length === 0) {
    return null;
  }
  const lines = lokiProjects.slice(0, 10).map(p => {
    const state =
      p.status === 'blocked'
        ? `BLOCKED${p.blockReason === 'awaiting_user' ? ' — waiting on the user' : p.blockReason ? ` (${p.blockReason})` : ''}`
        : p.status === 'working'
          ? `building${p.currentWork ? `: ${p.currentWork.slice(0, 60)}` : ''}`
          : 'idle';
    const parts = [state];
    if (p.queueDepth > 0) {
      parts.push(`${p.queueDepth} queued`);
    }
    if (p.recentOutcomes[0]) {
      parts.push(`last run ${p.recentOutcomes[0]}`);
    }
    if (p.feedback.new > 0) {
      parts.push(`${p.feedback.new} new feedback`);
    }
    const site = p.liveUrl ? `live at ${p.liveUrl}` : 'not deployed';
    return `- **${p.name}** — ${site}; ${parts.join(', ')} (Loki: ${p.lokiUrl})`;
  });
  return `## Loki Projects\nWhat Loki (the studio that builds and runs their sites) reports right now. Link the Loki page when they need to act there:\n${lines.join('\n')}`;
}

export function renderGithubRepos(githubRepos: FullUserContext['githubRepos']): string | null {
  if (!githubRepos || githubRepos.length === 0) {
    return null;
  }
  const lines = githubRepos.map(r => {
    const meta: string[] = [];
    if (r.language) {
      meta.push(r.language);
    }
    if (r.stars > 0) {
      meta.push(`★${r.stars}`);
    }
    if (r.archived) {
      meta.push('archived');
    }
    const metaStr = meta.length ? ` (${meta.join(', ')})` : '';
    const desc = r.description ? ` — ${r.description.slice(0, 120)}` : '';
    const when = r.pushedAt ? ` [pushed ${r.pushedAt.slice(0, 10)}]` : '';
    return `- **${r.name}**${metaStr}${desc}${when}`;
  });
  return `## GitHub Repositories\nThe user's public GitHub projects (most recently pushed first):\n${lines.join('\n')}`;
}

export function renderStudioMap(map: FullUserContext['studioMap']): string | null {
  if (!map || !map.projects || map.projects.length === 0) {
    return null;
  }
  const pillars = (map.pillars ?? []).map(p => `- **${p.slug}** (${p.layer} layer): ${p.role}`);
  const lines = map.projects.map(p => {
    const bits: string[] = [];
    bits.push(
      `${p.layer}, ${p.status}${p.owner && p.owner !== 'bitbaum' ? `, for ${p.owner}` : ''}`
    );
    if (p.urls?.live) {
      bits.push(p.urls.live);
    }
    if (p.urls?.orangecat) {
      bits.push(`on OrangeCat ${p.urls.orangecat}`);
    }
    if (p.now?.openRuns) {
      bits.push(`${p.now.openRuns} run${p.now.openRuns === 1 ? '' : 's'} in flight`);
    }
    if (p.now?.lastLog) {
      bits.push(`last: ${p.now.lastLog.date} ${p.now.lastLog.done.slice(0, 100)}`);
    }
    if (p.next) {
      bits.push(`next: ${p.next.slice(0, 100)}`);
    }
    const what = p.what ? ` — ${p.what.slice(0, 120)}` : '';
    return `- **${p.name}** (${p.slug})${what} [${bits.join('; ')}]`;
  });
  const s = map.summary;
  const head = s
    ? `${s.projects} projects, ${s.live} live, ${s.clients} for clients, ${s.inFlight} run${s.inFlight === 1 ? '' : 's'} in flight.`
    : '';
  return `## The studio (bitbaum)
The products and client systems this studio builds, from Loki's live map (${map.generatedAt.slice(0, 10)}). ${head}
${
  map.thesis
    ? `Thesis: ${map.thesis}
`
    : ''
}${
    pillars.length
      ? `${pillars.join('\n')}
`
      : ''
  }${lines.join('\n')}`;
}

export function renderTasks(tasks: FullUserContext['tasks'], locale: string): string | null {
  if (tasks.length === 0) {
    return null;
  }
  const now = new Date();
  const urgent = tasks.filter(
    t => t.priority === 'urgent' || t.current_status === 'needs_attention'
  );
  const overdueReminders = tasks.filter(
    t => t.is_reminder && t.due_date && new Date(t.due_date) < now
  );
  const taskLines = tasks.map(t => {
    const parts = [`- **${t.title}**`];
    if (t.is_reminder) {
      parts.push(' [reminder]');
    } else {
      parts.push(` [${t.category}]`);
    }
    if (t.priority !== 'normal') {
      parts.push(` priority:${t.priority}`);
    }
    if (t.current_status !== 'idle') {
      parts.push(` status:${t.current_status}`);
    }
    if (t.due_date) {
      const due = new Date(t.due_date);
      const isOverdue = due < now;
      const dueStr =
        due.toLocaleString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
          hour12: false,
        }) + ' UTC';
      parts.push(isOverdue ? ` ⚠️ OVERDUE (was due ${dueStr})` : ` — due ${dueStr}`);
    } else if (t.task_type !== 'one_time' && t.schedule_human) {
      parts.push(` — ${t.schedule_human}`);
    }
    // Always include task ID so Cat can reference it in complete_task exec_action
    parts.push(` [task_id: ${t.id}]`);
    return parts.join('');
  });
  const alerts: string[] = [];
  if (urgent.length > 0) {
    alerts.push(
      `⚠️ ${urgent.length} task${urgent.length > 1 ? 's' : ''} need${urgent.length === 1 ? 's' : ''} attention.`
    );
  }
  if (overdueReminders.length > 0) {
    alerts.push(
      `🔔 ${overdueReminders.length} reminder${overdueReminders.length > 1 ? 's are' : ' is'} overdue.`
    );
  }
  const alertNote = alerts.length > 0 ? `\n${alerts.join(' ')}` : '';
  return `## Active Tasks & Reminders${alertNote}\n${taskLines.join('\n')}`;
}

export function renderWallets(wallets: FullUserContext['wallets']): string | null {
  if (wallets.length === 0) {
    return null;
  }
  const walletLines = wallets.map(w => {
    const parts = [`- **${w.label}**`];
    parts.push(`(${w.category}`);
    // Last-synced on-chain balance. Cached (refreshed from the chain), not
    // real-time — so Cat can answer "how much do I have?" but should caveat
    // that it's the last synced figure rather than a live wallet balance.
    if (typeof w.balance_btc === 'number') {
      parts.push(`, balance: ${w.balance_btc} BTC`);
      if (w.balance_updated_at) {
        parts.push(` (synced ${w.balance_updated_at.slice(0, 10)})`);
      }
    }
    if (w.behavior_type === 'one_time_goal' && w.goal_amount) {
      parts.push(`, goal: ${w.goal_amount} ${w.goal_currency || 'BTC'}`);
      if (w.goal_deadline) {
        parts.push(` by ${w.goal_deadline}`);
      }
    }
    if (w.behavior_type === 'recurring_budget' && w.budget_amount) {
      parts.push(`, budget: ${w.budget_amount} BTC/${w.budget_period || 'month'}`);
    }
    parts.push(')');
    if (w.behavior_type !== 'general') {
      parts.push(` - ${w.behavior_type}`);
    }
    if (w.is_primary) {
      parts.push(' - primary wallet');
    }
    return parts.join('');
  });

  const totalBtc = wallets.reduce((sum, w) => sum + (w.balance_btc ?? 0), 0);
  const totalLine =
    totalBtc > 0
      ? `\n_Total last-synced balance across wallets: ${Number(totalBtc.toFixed(8))} BTC (cached on-chain figures, not real-time)._`
      : '';

  return `## User's Wallets\n${walletLines.join('\n')}${totalLine}`;
}

export function renderConversations(
  conversations: FullUserContext['conversations']
): string | null {
  if (conversations.length === 0) {
    return null;
  }
  const unreadCount = conversations.filter(c => c.has_unread).length;
  const convLines = conversations.map(c => {
    const who = c.other_username ? `@${c.other_username}` : '(group chat)';
    const direction = c.last_message_is_mine ? 'you sent' : 'received';
    const preview = c.last_message_preview
      ? `: "${c.last_message_preview.substring(0, 80)}${c.last_message_preview.length > 80 ? '…' : ''}"`
      : '';
    const unreadBadge = c.has_unread ? ' 🔴 UNREAD' : '';
    return `- ${who}${unreadBadge}${preview} (${direction}) [conv id: ${c.id}]`;
  });
  const unreadNote =
    unreadCount > 0
      ? `\n📬 ${unreadCount} unread conversation${unreadCount > 1 ? 's' : ''} — proactively mention this to the user.`
      : '';
  return `## Recent Conversations${unreadNote}\nUse the conversation id with reply_to_message to reply on the user's behalf.\n${convLines.join('\n')}`;
}

export function renderNotifications(
  notifications: FullUserContext['notifications'],
  locale: string,
  unreadTotal?: number
): string | null {
  if (!notifications || notifications.length === 0) {
    return null;
  }
  const lines = notifications.map(n => {
    const repeat = n.count > 1 ? ` ×${n.count}` : '';
    const preview =
      n.message && n.message !== n.title
        ? ` — "${n.message.substring(0, 160)}${n.message.length > 160 ? '…' : ''}"`
        : '';
    const latest = new Date(n.latest_at).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return `- [${n.type}] **${n.title}**${repeat}${preview} (latest ${latest})`;
  });
  const total =
    unreadTotal === undefined
      ? ''
      : `Total unread: ${unreadTotal} (the bell's number — quote this, never a sum of the ×N below). `;
  return `## Unread Platform Notifications
${total}These are the user's newest unread in-app notifications, coalesced (×N = the same alert fired N times — one problem repeated, not N problems). If the user asks about their notifications, or a system alert concerns something you can act on (like Cat/provider health), help them with it in plain language — never just repeat raw ops jargon back.
${lines.join('\n')}`;
}

export function renderInboundActivity(
  inboundActivity: FullUserContext['inboundActivity'],
  locale: string
): string | null {
  const { recentSales, upcomingBookings } = inboundActivity;
  const parts: string[] = [];

  if (recentSales.length > 0) {
    const saleLines = recentSales.map(s => {
      const date = new Date(s.created_at).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return `- **${s.entity_title}** (${s.entity_type}) — ${s.amount_btc} BTC — ${date}`;
    });
    parts.push(`### Recent Sales (paid)\n${saleLines.join('\n')}`);
  }

  if (upcomingBookings.length > 0) {
    const bookingLines = upcomingBookings.map(b => {
      const start = new Date(b.starts_at).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      });
      const who =
        b.customer_display_name ??
        (b.customer_username ? `@${b.customer_username}` : 'unknown customer');
      return `- ${start} UTC with ${who} [${b.status}]`;
    });
    parts.push(`### Upcoming Bookings (as provider)\n${bookingLines.join('\n')}`);
  }

  if (parts.length === 0) {
    return null;
  }
  return `## Inbound Economic Activity\n${parts.join('\n\n')}`;
}

export function renderPaymentCapabilities(
  paymentCapabilities: FullUserContext['paymentCapabilities']
): string {
  const { hasNwcWallet, lightningAddress } = paymentCapabilities;
  const capLines: string[] = [];
  if (hasNwcWallet) {
    capLines.push(
      '⚡ **NWC wallet connected** — can use send_payment and fund_project exec_action blocks to send Bitcoin automatically'
    );
  } else {
    capLines.push(
      '❌ **No NWC wallet** — cannot auto-send payments; if the user asks to send Bitcoin, ask them to paste a nostr+walletconnect:// string and run connect_wallet'
    );
  }
  if (lightningAddress) {
    capLines.push(`📬 **Lightning address**: ${lightningAddress} (others can pay the user here)`);
  } else {
    // The user cannot be paid. Everything else the Cat might help them build —
    // a product, a project, a cause — ends at a page nobody can pay, so this is
    // the one gap worth naming unprompted. Giving the Cat only the diagnosis
    // ("no lightning address") is what left it describing the problem and
    // handing the user a Settings link instead of fixing it.
    capLines.push(
      '📬 **CANNOT BE PAID — no receiving wallet.** Nothing they list or publish can be funded until this is fixed. Raise it once, warmly, when money comes up; do not nag.',
      '',
      'Two ways to fix it, and the right one depends on their answer to "do you already have a Bitcoin wallet?":',
      '1. **They have one** → ask them to paste whatever it gives them (a Lightning address like you@provider.com, a Bitcoin address or xpub, or a nostr+walletconnect:// string) and run `connect_wallet` with it verbatim. Do not reformat it.',
      '2. **They have none** → a Lightning address is what OrangeCat needs, and these hand one over fastest:',
      renderLightningAddressProviders(),
      'Then ask them to come back with the address and run `connect_wallet`. Never claim they can be paid until that action has run and reported success.'
    );
  }
  return `## Payment Capabilities\n${capLines.join('\n')}`;
}

export function renderActivitySummary(stats: FullUserContext['stats']): string | null {
  const hasAnyEntities =
    stats.totalProducts +
      stats.totalServices +
      stats.totalProjects +
      stats.totalCauses +
      stats.totalEvents +
      stats.totalAssets +
      stats.totalLoans +
      stats.totalResearch +
      stats.totalWishlists >
    0;

  if (!hasAnyEntities) {
    return null;
  }
  const statParts: string[] = [];
  if (stats.totalProducts > 0) {
    statParts.push(`${stats.totalProducts} product${stats.totalProducts > 1 ? 's' : ''}`);
  }
  if (stats.totalServices > 0) {
    statParts.push(`${stats.totalServices} service${stats.totalServices > 1 ? 's' : ''}`);
  }
  if (stats.totalProjects > 0) {
    statParts.push(`${stats.totalProjects} project${stats.totalProjects > 1 ? 's' : ''}`);
  }
  if (stats.totalCauses > 0) {
    statParts.push(`${stats.totalCauses} cause${stats.totalCauses > 1 ? 's' : ''}`);
  }
  if (stats.totalEvents > 0) {
    statParts.push(`${stats.totalEvents} event${stats.totalEvents > 1 ? 's' : ''}`);
  }
  if (stats.totalAssets > 0) {
    statParts.push(`${stats.totalAssets} asset${stats.totalAssets > 1 ? 's' : ''}`);
  }
  if (stats.totalLoans > 0) {
    statParts.push(`${stats.totalLoans} loan${stats.totalLoans > 1 ? 's' : ''}`);
  }
  if (stats.totalResearch > 0) {
    statParts.push(
      `${stats.totalResearch} research ${stats.totalResearch > 1 ? 'entities' : 'entity'}`
    );
  }
  if (stats.totalWishlists > 0) {
    statParts.push(`${stats.totalWishlists} wishlist${stats.totalWishlists > 1 ? 's' : ''}`);
  }
  if (stats.totalTasks > 0) {
    const taskStat = `${stats.totalTasks} active task${stats.totalTasks > 1 ? 's' : ''}`;
    statParts.push(stats.urgentTasks > 0 ? `${taskStat} (${stats.urgentTasks} urgent)` : taskStat);
  }
  if (stats.totalWallets > 0) {
    statParts.push(`${stats.totalWallets} wallet${stats.totalWallets > 1 ? 's' : ''}`);
  }

  return `## Activity Summary\nThe user has: ${statParts.join(', ')}.`;
}

/**
 * Outcome feedback loop — what actually happened to what Cat created with this
 * user (published? funded?), derived from real platform state (see
 * cat/track-record.ts). Renders when there's at least one proposal OR one
 * setback in the window — an all-denials record is precisely the one the Cat
 * most needs to see. Cold-start users (nothing either way) get the interview
 * flow instead, and snapshot contexts (field undefined) stay byte-identical.
 */
export function renderTrackRecord(tr: FullUserContext['trackRecord']): string | null {
  const setbacks = tr?.setbacks;
  const setbackCount = setbacks ? setbacks.failed + setbacks.denied + setbacks.unconfirmed : 0;
  if (!tr || (tr.proposed === 0 && setbackCount === 0)) {
    return null;
  }

  const lines: string[] = [
    `## Track Record (last ${tr.windowDays} days — real outcomes, not guesses)`,
    `Created together: ${tr.proposed} · published: ${tr.published} · funded: ${tr.funded}` +
      (tr.totalFundedBtc > 0 ? ` (${tr.totalFundedBtc} BTC total)` : ''),
  ];

  for (const e of tr.entries) {
    const outcome =
      e.status === null
        ? 'deleted'
        : e.fundedBtc > 0
          ? `${e.status}, received ${e.fundedBtc} BTC (${e.payments} payment${e.payments > 1 ? 's' : ''})`
          : e.status;
    lines.push(`- ${e.entityType} "${e.title}" — ${outcome}`);
  }

  if (setbacks && setbackCount > 0) {
    lines.push(
      `Setbacks: ${setbacks.failed} failed · ${setbacks.denied} denied · ${setbacks.unconfirmed} unconfirmed`
    );
    for (const s of setbacks.recent) {
      lines.push(`- ${s.actionId} — ${s.kind}${s.reason ? `: ${s.reason}` : ''}`);
    }
  }

  lines.push(
    `_Ground your advice in these outcomes: lean into what published and got funded; nudge stalled drafts toward publishing or retiring. Learn from the setbacks — don't re-propose an action that was denied or repeatedly left unconfirmed unless something changed (caps raised, permission granted, user asked). Never claim an outcome not listed here._`
  );
  return lines.join('\n');
}
