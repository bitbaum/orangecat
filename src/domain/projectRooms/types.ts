import type { RoomContent, RoomOpenKind } from '@/config/project-room';

export type RoomResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: 'not_found' | 'forbidden' | 'revoked' | 'invalid' | 'db_error';
      message: string;
    };

/** The project a room belongs to — only what the room shows or needs. */
export interface RoomProject {
  id: string;
  title: string;
  description: string | null;
  website_url: string | null;
  cover_image_url: string | null;
  actor_id: string | null;
  user_id: string | null;
}

/** A link as its OWNER sees it. The token is included: the owner copies it. */
export interface RoomLink {
  id: string;
  token: string;
  label: string;
  email: string | null;
  is_shared: boolean;
  created_at: string;
  revoked_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
}

export interface RoomOpen {
  link_id: string;
  what: RoomOpenKind;
  target: string | null;
  opened_at: string;
}

export interface OwnerRoom {
  project: RoomProject;
  /** False until the owner first saves; `content` is then the outline. */
  exists: boolean;
  content: RoomContent;
  links: RoomLink[];
  opens: RoomOpen[];
}

/** What a person holding a link sees. Never the link list or anyone's opens. */
export interface VisitorRoom {
  project: RoomProject;
  content: RoomContent;
  linkLabel: string;
}
