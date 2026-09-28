/**
 * The tools OrangeCat's MCP server offers — what an AI app (claude.ai, ChatGPT,
 * Claude Code, Cursor) can do for the person who connected it.
 *
 * A deliberately small first set. Every tool reuses the code path its /api/v1
 * twin runs — search through searchPlatform, writes through the v1 handlers
 * themselves (see v1Bridge.ts) — so MCP never becomes a second implementation
 * of a business rule.
 *
 * Descriptions are written for a MODEL deciding whether to call the tool: when
 * it applies, what it needs, what comes back. Each tool names the one scope it
 * needs; a call without it answers with a tool error that says which, so the
 * model can tell the person to reconnect with more access instead of guessing.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SITE_URL } from '@/config/brand';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_TYPES, getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { EXTERNAL_PUBLISHABLE_EVENT_TYPES, externalPublishSchema } from '@/config/external-publish';
import { PUBLIC_API_INTEGRATION_ENDPOINTS, publicApiEndpoint } from '@/config/public-api';
import { ROUTES } from '@/config/routes';
import { OAUTH_SCOPES } from '@/lib/oauth/config';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { projectSchema } from '@/lib/validation/projects';
import { ownedProjectsFilter } from '@/domain/projects/service';
import { searchPlatform, SEARCH_TYPES } from '@/services/cat/platform-search';
import { POST as createProjectV1 } from '@/app/api/v1/projects/route';
import { POST as publishTimelineV1 } from '@/app/api/v1/timeline/publish/route';
import type { McpCaller } from './auth';
import { callV1, describeV1Failure, type V1Handler } from './v1Bridge';

export interface McpToolContext {
  caller: McpCaller;
  /** The inbound MCP request — origin + client-IP hop for bridged v1 calls. */
  request: Request;
}

export interface McpTool {
  name: string;
  title: string;
  description: string;
  /** The scope this tool needs, or null when any connected caller may use it. */
  scope: string | null;
  /** When the scope depends on the arguments (which type to list), per call. */
  scopeFor?: (args: Record<string, unknown>) => string;
  inputSchema: z.ZodRawShape;
  readOnly: boolean;
  run(args: Record<string, unknown>, ctx: McpToolContext): Promise<CallToolResult>;
}

// ── Result helpers ───────────────────────────────────────────────────────────

/** A result as both prose-readable JSON text and structured content. */
function ok(summary: string, data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify(data, null, 2)}` }],
    structuredContent: data,
  };
}

export function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** The tool error for a call the connection was not granted. */
export function missingScopeError(toolName: string, scope: string): CallToolResult {
  const what = OAUTH_SCOPES.find(s => s.name === scope)?.description ?? scope;
  return toolError(
    `This connection is missing the "${scope}" permission (${what}), which ${toolName} needs. ` +
      'Ask the person to reconnect OrangeCat and allow it, then try again.'
  );
}

function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

const adminDb = (): AnySupabaseClient => createAdminClient() as unknown as AnySupabaseClient;

// ── orangecat_my_entities: which types can be listed ─────────────────────────

/**
 * Entity types a connection can list: those with a `${type}.read` scope that
 * are owned by actor. Derived, so granting a new read scope is all it takes to
 * open a type up here.
 */
export const READABLE_ENTITY_TYPES = ENTITY_TYPES.filter(
  t =>
    OAUTH_SCOPES.some(s => s.name === `${t}.read`) &&
    getEntityMetadata(t).userIdField === 'actor_id'
) as [EntityType, ...EntityType[]];

function ownershipFilter(type: EntityType, caller: McpCaller): string {
  // Projects have the one legacy nuance (pre-actor rows keyed by creator) and
  // their own SSOT for it; every other actor-owned type is a plain match.
  return type === 'project'
    ? ownedProjectsFilter(caller.actorId, caller.userId)
    : `${getEntityMetadata(type).userIdField}.eq.${caller.actorId}`;
}

// ── The tools ────────────────────────────────────────────────────────────────

const projectInput = projectSchema.pick({
  title: true,
  description: true,
  goal_amount: true,
  currency: true,
  funding_purpose: true,
  category: true,
  tags: true,
  website_url: true,
  status: true,
}).shape;

const timelinePath =
  PUBLIC_API_INTEGRATION_ENDPOINTS.find(e => e.name === 'timeline.publish')?.endpoint ?? '';

export const MCP_TOOLS: readonly McpTool[] = [
  {
    name: 'orangecat_whoami',
    title: 'Who am I on OrangeCat',
    description:
      'Returns the OrangeCat identity this connection acts as — actor id, username, display name, profile link — and the permissions (scopes) it was granted. Call this first when you need to know whose account you are working in, or before a write to check the permission is there.',
    scope: null,
    inputSchema: {},
    readOnly: true,
    async run(_args, { caller }) {
      const db = adminDb();
      const [{ data: actor }, { data: profile }] = await Promise.all([
        db
          .from(DATABASE_TABLES.ACTORS)
          .select('id, actor_type, display_name, slug')
          .eq('id', caller.actorId)
          .maybeSingle(),
        db
          .from(DATABASE_TABLES.PROFILES)
          .select('username, name')
          .eq('id', caller.userId)
          .maybeSingle(),
      ]);
      const username = (profile?.username as string | null) ?? null;
      const data = {
        actor_id: caller.actorId,
        actor_type: (actor?.actor_type as string | null) ?? null,
        username,
        name: (profile?.name as string | null) ?? (actor?.display_name as string | null) ?? null,
        profile_url: username ? absoluteUrl(ROUTES.PROFILES.VIEW(username)) : null,
        scopes: caller.scopes,
        connected_via: caller.source === 'oidc' ? 'OrangeCat sign-in' : 'integration key',
      };
      return ok(`Signed in to OrangeCat as ${data.name ?? username ?? caller.actorId}.`, data);
    },
  },
  {
    name: 'orangecat_search',
    title: 'Search OrangeCat',
    description:
      "Searches everything public on OrangeCat by meaning — people, projects, products, services, events and causes. Use it to find who offers something, what is being funded, or whether something already exists. Returns up to 5 matches per type with a title, a short description and a link. Only public listings are searched; it never sees anyone's drafts.",
    scope: null,
    inputSchema: {
      query: z.string().min(2).max(300).describe('What to look for, in plain words.'),
      type: z.enum(SEARCH_TYPES).default('all').describe('Narrow to one kind of result, or "all".'),
    },
    readOnly: true,
    async run(args) {
      const query = String(args.query).trim();
      const type = args.type as (typeof SEARCH_TYPES)[number];
      const results = await searchPlatform(adminDb(), query, type);
      const data = {
        query,
        type,
        results: results.map(r => ({ ...r, url: absoluteUrl(r.url) })),
      };
      return ok(`${results.length} result(s) for "${query}".`, data);
    },
  },
  {
    name: 'orangecat_my_entities',
    title: 'List my OrangeCat entities',
    description: `Lists the signed-in person's own OrangeCat entities of one type, newest first, including drafts — for example their projects. Use it to find the id of a project before posting an update to it, or to answer "what am I running on OrangeCat?". Listable types: ${READABLE_ENTITY_TYPES.join(', ')}.`,
    scope: `${READABLE_ENTITY_TYPES[0]}.read`,
    scopeFor: args => `${String(args.type ?? READABLE_ENTITY_TYPES[0])}.read`,
    inputSchema: {
      type: z
        .enum(READABLE_ENTITY_TYPES)
        .default(READABLE_ENTITY_TYPES[0])
        .describe('Which kind of entity to list.'),
      limit: z.number().int().min(1).max(50).default(20).describe('How many to return.'),
    },
    readOnly: true,
    async run(args, { caller }) {
      const type = args.type as EntityType;
      const meta = getEntityMetadata(type);
      const titleColumn = meta.titleColumn ?? 'title';
      const { data, error } = await adminDb()
        .from(meta.tableName)
        .select(`id, ${titleColumn}, status, created_at`)
        .or(ownershipFilter(type, caller))
        .order('created_at', { ascending: false })
        .limit(Number(args.limit));
      if (error) {
        return toolError(`Could not list ${meta.namePlural.toLowerCase()}: ${error.message}`);
      }
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      const items = rows.map(row => ({
        id: row.id as string,
        title: (row[titleColumn] as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        created_at: row.created_at as string,
        url: meta.detailPath ? absoluteUrl(meta.detailPath(String(row.id))) : null,
      }));
      return ok(`${items.length} ${meta.namePlural.toLowerCase()}.`, { type, items });
    },
  },
  {
    name: 'orangecat_create_project',
    title: 'Create an OrangeCat project',
    description:
      'Creates a project on OrangeCat for the signed-in person — a defined outcome people can fund, with a goal and a purpose. It is created as a DRAFT unless status "active" is given, so nothing is public until the person publishes it; say so when you report back. goal_amount is a whole number in the given currency (default CHF). Confirm the title and description with the person before calling.',
    scope: 'project.write',
    inputSchema: projectInput,
    readOnly: false,
    async run(args, { caller, request }) {
      const result = await callV1(createProjectV1 as V1Handler, {
        origin: request,
        path: publicApiEndpoint('project'),
        bearer: caller.bearer,
        body: args,
      });
      if (result.status !== 201) {
        return toolError(`The project was not created. ${describeV1Failure(result)}`);
      }
      const project = (result.body?.data ?? {}) as Record<string, unknown>;
      const meta = getEntityMetadata('project');
      const url = meta.detailPath ? absoluteUrl(meta.detailPath(String(project.id))) : null;
      return ok(`Created project "${String(project.title)}" (${String(project.status)}).`, {
        id: project.id,
        title: project.title,
        status: project.status,
        url,
      });
    },
  },
  {
    name: 'orangecat_post_update',
    title: 'Post a project update',
    description:
      "Posts an update to one of the person's own OrangeCat projects; it appears on the project's wall, marked as posted via an AI app. Use it when the person asks to share progress, a milestone, or that something shipped. Needs the project id (orangecat_my_entities lists them). Public by default.",
    scope: 'timeline.write',
    inputSchema: {
      project_id: z.string().uuid().describe('The id of a project the person owns.'),
      title: externalPublishSchema.shape.title.describe('One line: what happened.'),
      description: externalPublishSchema.shape.description.describe('Optional detail.'),
      event_type: z
        .enum(EXTERNAL_PUBLISHABLE_EVENT_TYPES)
        .default('project_updated')
        .describe('project_updated for general progress; the others mark a milestone.'),
      visibility: externalPublishSchema.shape.visibility.describe(
        'public (default), followers, or private.'
      ),
    },
    readOnly: false,
    async run(args, { caller, request }) {
      const result = await callV1(publishTimelineV1 as V1Handler, {
        origin: request,
        path: timelinePath,
        bearer: caller.bearer,
        body: {
          source: 'ai_app',
          // One post per call: an AI app has no event spine of its own to
          // dedupe against, so every call is a new event.
          external_id: randomUUID(),
          subject_type: 'project',
          subject_id: args.project_id,
          title: args.title,
          description: args.description,
          event_type: args.event_type,
          visibility: args.visibility,
        },
      });
      if (result.status !== 201 && result.status !== 200) {
        return toolError(`The update was not posted. ${describeV1Failure(result)}`);
      }
      const data = (result.body?.data ?? {}) as Record<string, unknown>;
      return ok('Posted the update to the project wall.', {
        id: data.id,
        project_id: args.project_id,
      });
    },
  },
];
