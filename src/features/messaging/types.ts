import type { MessageAttachmentDto } from './server/attachments';

export interface Participant {
  user_id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  last_read_at: string;
  is_active: boolean;
  /** The Cat or a bot's seat: an agent, shown as one. */
  is_agent?: boolean;
  /** What a bot that is not the viewer's charges them per message, in BTC. */
  agent_price_btc?: number;
}

export interface Conversation {
  id: string;
  title: string | null;
  is_group: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id?: string | null;
  participants: Participant[];
  unread_count: number;
}

export interface MessageReplyDto {
  id: string;
  sender_id: string;
  /** One line of its words; empty for a message of only files. */
  body: string;
  kinds?: Array<'image' | 'video' | 'audio' | 'file'>;
}

export interface MessageReactionDto {
  emoji: string;
  user_ids: string[];
}

export interface MessagePaymentRequestDto {
  id: string;
  requester_id: string;
  payer_id: string;
  amount_btc: number;
  ask_amount: number | null;
  ask_currency: string | null;
  note: string | null;
  status: 'pending' | 'paid' | 'declined' | 'cancelled';
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  edited_at: string | null;
  sender?: {
    id: string;
    username: string;
    name: string;
    avatar_url: string | null;
    is_agent?: boolean;
  };
  /** The message this one answers, as it was when the answer was sent. */
  reply_to?: MessageReplyDto | null;
  reactions?: MessageReactionDto[];
  /** The payment request this message carries, as it stands now. */
  payment_request?: MessagePaymentRequestDto | null;
  /** Files sent with the message (features/messaging/server/attachments.ts). */
  attachments?: MessageAttachmentDto[];
  is_read?: boolean;
  is_delivered?: boolean;
  status?: 'pending' | 'failed' | 'sent' | 'delivered' | 'read';
}

export type { CursorPagination as Pagination } from '@/types/pagination';
