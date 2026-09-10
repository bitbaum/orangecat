import { classifyWalletInput } from '@/types/wallet';
import type { CatAction } from '@/config/cat-actions';

export function generateActionDescription(
  action: CatAction,
  parameters: Record<string, unknown>
): string {
  switch (action.id) {
    case 'create_product': {
      const price = parameters.price_btc ?? parameters.price ?? 'unpriced';
      return `Create product "${parameters.title}" priced at ${price} BTC`;
    }
    case 'create_service': {
      const rate = parameters.hourly_rate ?? parameters.fixed_price;
      return `Create service "${parameters.title}"${rate ? ` at ${rate} BTC` : ''}`;
    }
    case 'create_project': {
      const goal = parameters.goal_btc ?? parameters.goal_amount ?? 'open-ended';
      return `Create project "${parameters.title}" with goal of ${goal} BTC`;
    }
    case 'create_cause':
      return `Create cause "${parameters.title}"`;
    case 'create_project_for_person': {
      const who = String(parameters.person_name ?? 'them');
      const visibility =
        parameters.publish === false ? 'as a draft only you can see' : 'as a public page';
      return `Set up "${parameters.title}" for ${who} ${visibility}, owned by ${who} — you get a link to send; ${who} takes it over by signing up, and nothing can receive money until then`;
    }
    case 'send_to_fleetcrown':
      return `Create a FleetCrown handoff link for "${parameters.title ?? parameters.entity_id}" (valid 10 minutes) so AI agents can build it`;
    case 'create_investment': {
      const target = parameters.target_amount_btc ?? parameters.target_amount ?? 'open-ended';
      const type = parameters.investment_type || 'revenue_share';
      return `Create ${type} investment "${parameters.title}" targeting ${target} BTC`;
    }
    case 'create_loan': {
      const amount = parameters.amount_btc ?? 'unspecified';
      const rate = parameters.interest_rate ? ` at ${parameters.interest_rate}% interest` : '';
      return `Create loan request "${parameters.title}" for ${amount} BTC${rate}`;
    }
    case 'create_research': {
      const goal = parameters.funding_goal_btc ?? 0.001;
      const field = parameters.field ? ` [${parameters.field}]` : '';
      return `Create research entity "${parameters.title}"${field} with ${goal} BTC funding goal`;
    }
    case 'create_wishlist': {
      const type = parameters.type ? ` (${parameters.type})` : '';
      return `Create wishlist "${parameters.title}"${type}`;
    }
    case 'create_event':
      return `Create event "${parameters.title}" at ${parameters.location}`;
    case 'create_asset':
      return `Register asset "${parameters.title}"${parameters.location ? ` at ${parameters.location}` : ''}`;
    case 'update_entity':
      return `Update ${parameters.entity_type} with ${Object.keys(typeof parameters.updates === 'object' ? (parameters.updates as object) : {}).join(', ') || 'changes'}`;
    case 'publish_entity':
      return `Publish ${parameters.entity_type} (make it live)`;
    case 'archive_entity':
      return `Archive ${parameters.entity_type} (remove from public view)`;
    case 'post_to_timeline':
      return `Post to timeline: "${String(parameters.content).slice(0, 50)}..."`;
    case 'send_message':
      return `Send message to user`;
    case 'reply_to_message':
      return `Reply in conversation: "${String(parameters.content).slice(0, 50)}"`;
    case 'invite_to_organization':
      return `Invite user to organization (role: ${parameters.role || 'member'})`;
    case 'send_payment': {
      const amount = parameters.amount_btc;
      return `Send ${amount} BTC to ${parameters.recipient}`;
    }
    case 'fund_project': {
      const amount = parameters.amount_btc;
      return `Fund project with ${amount} BTC`;
    }
    case 'add_context':
      return `Add context document: "${parameters.title}"`;
    case 'save_economic_profile':
      return 'Update your economic profile';
    case 'create_task': {
      const priority = parameters.priority ? ` [${parameters.priority}]` : '';
      const due = parameters.due_date ? ` due ${parameters.due_date}` : '';
      return `Create task: "${parameters.title}"${priority}${due}`;
    }
    case 'set_reminder': {
      const reminderTitle =
        (parameters.title as string | undefined) ||
        (parameters.message as string | undefined) ||
        'reminder';
      const reminderWhen =
        (parameters.due_date as string | undefined) ||
        (parameters.when as string | undefined) ||
        'no date';
      return `Set reminder: "${reminderTitle}" — ${reminderWhen}`;
    }
    case 'complete_task':
      return `Mark task as completed (id: ${parameters.task_id})`;
    case 'update_task': {
      const parts: string[] = [];
      if (parameters.title) {
        parts.push(`rename to "${parameters.title}"`);
      }
      if (parameters.due_date) {
        parts.push(`reschedule to ${parameters.due_date}`);
      }
      if (parameters.priority) {
        parts.push(`priority → ${parameters.priority}`);
      }
      return `Update task (id: ${parameters.task_id})${parts.length ? ': ' + parts.join(', ') : ''}`;
    }
    case 'create_organization':
      return `Create organization "${parameters.name}"`;
    case 'update_profile': {
      // A handle change is named on its own, and names what happens to the old
      // one: "update profile: username" would hide the only part of this write
      // that changes a public URL and a payment address.
      if (typeof parameters.username === 'string' && parameters.username) {
        const handle = parameters.username.replace(/^@/, '');
        return `Change your handle to @${handle} (your old handle keeps working)`;
      }
      const fields = ['name', 'bio', 'background', 'website', 'location_city', 'location_country']
        .filter(f => parameters[f] !== undefined)
        .join(', ');
      return `Update profile${fields ? ': ' + fields : ''}`;
    }
    case 'connect_wallet': {
      // Show the KIND, never the string itself. This confirmation is what the
      // user reads before approving where their money lands, and an NWC URI is a
      // spending credential that must not be echoed back into the transcript.
      const kind = classifyWalletInput((parameters.wallet_string as string | undefined) ?? '');
      const kindLabel: Record<string, string> = {
        lightning: 'Lightning address',
        onchain: 'Bitcoin address',
        xpub: 'extended public key',
        nwc: 'wallet connection',
        unknown: 'wallet details',
      };
      return `Connect wallet: set your ${kindLabel[kind]} as where you get paid`;
    }
    case 'add_wallet': {
      const walletLabel = parameters.label as string | undefined;
      const btype = parameters.behavior_type as string | undefined;
      const typeLabel =
        btype === 'one_time_goal' ? ' (goal)' : btype === 'recurring_budget' ? ' (budget)' : '';
      return `Create wallet: "${walletLabel ?? 'unnamed'}"${typeLabel}`;
    }
    default:
      return `Execute ${action.name}`;
  }
}
