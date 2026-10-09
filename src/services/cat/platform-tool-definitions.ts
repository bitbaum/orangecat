/**
 * The Cat's platform (read/draft) tool definitions — what the model is told it
 * can call. Split from tool-use-detection.ts (500-line service limit); that
 * file re-exports both names, so importers did not move.
 */

import { CAT_CREATABLE_ENTITY_TYPES } from '@/types/cat';
import { MY_DATA_TOPICS } from './my-data-topics';
import { SEARCH_SCOPES } from './following-scope';

/**
 * "everyone" (default) or "following" — the people the user follows. Shared by
 * search_platform and explore_topic so both tools say it the same way; the
 * values are SSOT in ./following-scope (SEARCH_SCOPES).
 */
const SCOPE_PARAMETER = {
  type: 'string',
  enum: SEARCH_SCOPES as unknown as string[],
  description:
    'Who to search. "everyone" (default) = all of OrangeCat. "following" = ONLY the people the user follows — use it whenever they say "people I follow", "my follows", "my network", "the people I\'m following".',
};

const DAYS_PARAMETER = {
  type: 'number',
  description:
    'Optional look-back window in days for scope "following" ("this week" = 7, "today" = 1, "this month" = 30). Omit for any time.',
};

/** Entity types Cat can DRAFT via the prefill tool. Derived from the creatable SSOT so the
 *  two lists can't drift. `group` is creatable but not prefillable — it uses a `name`, not the
 *  form-field prefill flow. Add an entry here only by removing it from this exclusion set. */
const NON_PREFILLABLE_ENTITY_TYPES = new Set<string>(['group']);
export const PREFILLABLE_ENTITY_TYPES = CAT_CREATABLE_ENTITY_TYPES.filter(
  t => !NON_PREFILLABLE_ENTITY_TYPES.has(t)
);

export const PLATFORM_TOOL_DEFINITION = [
  {
    type: 'function',
    function: {
      name: 'search_platform',
      description:
        'Search OrangeCat for people, projects, products, services, events, or causes. Use when the user wants to find, connect with, or discover someone or something on the platform. With scope "following" it searches ONLY the people the user follows — their public timeline posts and listings, newest first — for "what did people I follow post about X?", "anything from my follows this week?", "search the people I follow".',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'What to search for. With scope "following" it may be empty ("" = everything they posted).',
          },
          type: {
            type: 'string',
            enum: ['all', 'people', 'projects', 'products', 'services', 'events', 'causes'],
            description: 'Type of content to search. Use "all" when unsure.',
          },
          scope: SCOPE_PARAMETER,
          days: DAYS_PARAMETER,
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prefill_entity_form',
      description:
        'Draft an entity (product, service, project, etc.) from a natural-language description. Use this INSTEAD of a create_* exec_action when the user has described what they want to create with enough detail (title-ish hint + at least one specific attribute like price, location, category, audience). Returns structured fields the user can review in a form before publishing — never auto-creates. NOT for something that belongs to another person who is not on OrangeCat yet: that is create_project_for_person.',
      parameters: {
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            enum: PREFILLABLE_ENTITY_TYPES as unknown as string[],
            description: 'Which kind of entity to draft.',
          },
          description: {
            type: 'string',
            description:
              'A full natural-language description of the entity. Include everything the user said about it: what it is, who it is for, price if mentioned, location, materials, ingredients, schedule, etc. Min 10 chars.',
          },
        },
        required: ['entityType', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_website',
      description:
        "Fetch and read a business website whose URL the user pasted in their message, returning the site's readable text. Use when the user shares a site URL and wants to be set up on OrangeCat, or asks you to analyze/import/read their site. Only URLs actually present in the user's message can be fetched. After reading the result, propose entities via prefill_entity_form grounded STRICTLY in what the site says — never invent.",
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: "The exact http(s) URL from the user's message.",
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_offers',
      description:
        'The economic agent. Call this when the user asks what they could offer, sell, or create, how they could make money, or wants ideas grounded in who they are. It reads everything OrangeCat knows about them (profile, documents, memories, existing entities) and proposes several concrete, ready-to-publish offers across the economic spectrum, each as a draft card. Takes no required arguments — it reads their stored context, not the message.',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            description:
              'Optional area to focus suggestions on (e.g. "design", "teaching", "renting out gear"). Omit for a broad spread.',
          },
          count: {
            type: 'number',
            description: 'How many offers to propose (1-5). Default 4.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forget_memories',
      description:
        'Delete stored memories about the user that they say are wrong or want removed ("that\'s not true", "I don\'t speak French", "forget that", "remove X from what you know"). Pass each wrong fact as a short phrase close to the user\'s wording. This is the ONLY way to change stored memories — without calling it, nothing changes, so never claim a memory was removed unless this tool confirmed it.',
      parameters: {
        type: 'object',
        properties: {
          facts: {
            type: 'array',
            items: { type: 'string' },
            description:
              'The wrong or unwanted facts to forget, one short phrase each (e.g. ["photography skills", "speaks French", "only available on weekends"]).',
          },
        },
        required: ['facts'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'explore_topic',
      description:
        "Explore a TOPIC or INTEREST across all of OrangeCat and find the people behind it. Use whenever the user expresses an interest or curiosity rather than naming a specific thing to find ('I'm interested in longevity', 'anyone working on Bitcoin education?', 'what's happening with regenerative farming?', 'introduce me to people doing X'). Returns related public projects, research, products, services, causes and events — each attributed to its owner — plus the people working in that space, so you can offer a real introduction. Prefer this over search_platform for interests; search_platform is for finding a specific known thing. With scope \"following\" it looks only at what the people the user follows have posted and published on the topic (\"what are people I follow saying about Lightning?\").",
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description:
              "The interest or subject area, in the user's own words (e.g. 'longevity research', 'Bitcoin education for kids').",
          },
          entityType: {
            type: 'string',
            description:
              'Optional: restrict to one entity type (project, research, product, service, cause, event, …). Omit to search everything, which is usually right.',
          },
          scope: SCOPE_PARAMETER,
          days: DAYS_PARAMETER,
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_my_data',
      description:
        "Read the user's OWN live platform data and answer questions about it: their listings/entities, earnings and sales, upcoming bookings, wallet balances and goals, unread notifications, and open tasks. Use whenever the user asks about their own stuff or performance ('how much did I earn', 'what am I selling', 'any bookings coming up', 'catch me up'). Read-only — it changes nothing. Prefer topic 'overview' when the question spans several areas.",
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: MY_DATA_TOPICS as unknown as string[],
            description: 'Which slice of their data to read.',
          },
          days: {
            type: 'number',
            description: 'Look-back window in days for earnings (default 30, max 365).',
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        "Search the open web. Use for anything that is not stored on OrangeCat: what a thing costs elsewhere, whether a grant or programme is real and still open, who works in a field, what a tool does, current rules, prices, dates and events. Also use it before advising on something you are not certain is still true — your training has a cutoff and the user's question usually does not. This searches the WORLD; search_platform and explore_topic search OrangeCat's own members and listings, so use those for finding people and projects on the platform itself. Results come back as citable sources you must cite by handle.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'What to search for, phrased as a search query rather than a question. Include the specifics that matter (place, currency, year) — "coworking desk price Zurich 2026" beats "how much is a desk".',
          },
          site: {
            type: 'string',
            description:
              'Optional: restrict to one domain, e.g. "admin.ch" or "github.com". Use when the user named a source, or when only an official page will settle the question.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_page',
      description:
        "Open one web page and read its text. Call this after web_search whenever the answer needs a real figure, date, term or name — a search snippet is one line an engine chose and is where a confidently wrong number comes from. You may ONLY pass a url that the user wrote in their message or that appeared in a search result in this conversation; any other url is refused, so search first and read from the results. Returns the page's readable text as a citable source.",
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              "The exact url, copied from the search result or the user's message. Never a url you composed yourself.",
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_cat_health',
      description:
        "Live health check of the AI providers powering the Cat. Call when the user asks why the Cat/AI is failing, slow, or not answering, or asks about a system notification that mentions provider failures, eval/harness errors, or Cat health. Returns per-provider status (ok / rate-limited / auth failure / down) that explains what's wrong in actionable terms. Takes no arguments.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_events_near',
      description:
        'Upcoming public events near a place, nearest first — "parties in Zürich this weekend?", "any jazz near me?". Read-only.',
      parameters: {
        type: 'object',
        properties: {
          place: { type: 'string', description: 'City, street or venue to search around' },
          genre: { type: 'string', description: 'Music genre, only if the user named one' },
          radius_km: { type: 'number', description: 'Search radius in km (default 25)' },
        },
        required: ['place'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_my_track_record',
      description:
        "What YOU (the Cat) have done for this user and what became of it: the entities you created in the last 90 days — proposed → published → funded, with real BTC amounts — plus your own setbacks (failed or denied actions, proposals the user never confirmed). Call when the user asks what you did for them, how your suggestions worked out, or whether to trust you; and call it BEFORE proposing something new when you may have proposed the same kind before. Read-only. Takes no arguments. NOT for the user's own numbers or listings — that is query_my_data.",
      parameters: { type: 'object', properties: {} },
    },
  },
];
