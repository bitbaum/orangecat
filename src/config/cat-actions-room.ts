import { FileText, Lock } from 'lucide-react';
import type { CatAction } from './cat-actions';

const project = {
  name: 'project_id',
  type: 'entity_id',
  required: true,
  description: 'The actual OrangeCat project ID. Resolve the project first; never invent an ID.',
} as const;

/** Every project has the same room operations, in the UI and in Cat. */
export const INVESTOR_ROOM_ACTIONS: Record<string, CatAction> = {
  get_investor_room: {
    id: 'get_investor_room',
    name: 'Read investor room',
    category: 'context',
    icon: Lock,
    description:
      'Read an owned project’s room, deck, recipient links, opens and connected product record.',
    riskLevel: 'low',
    requiresConfirmation: false,
    parameters: [project],
    examples: ['Show me Heidi’s investor room', 'Who opened my project’s investor room?'],
    enabled: true,
  },
  save_investor_room: {
    id: 'save_investor_room',
    name: 'Save investor room',
    category: 'entities',
    icon: FileText,
    description: 'Patch investor-room content; preserve omitted fields and use sourced facts.',
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      project,
      {
        name: 'content',
        type: 'object',
        required: true,
        description:
          'Only fields to change: headline, sections [{title,body}], metrics [{label,value,verify}], metrics_as_of (YYYY-MM-DD), deck_url, documents [{title,url}], contact_email. Arrays replace that field; omitted fields stay unchanged. Never invent figures.',
      },
    ],
    examples: ['Set up my project’s investor room', 'Update the ask in Heidi’s room'],
    enabled: true,
  },
  create_investor_room_link: {
    id: 'create_investor_room_link',
    name: 'Create investor room link',
    category: 'entities',
    icon: Lock,
    description: 'Create a private recipient link; return it without sending an invitation.',
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      project,
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Who this private link is for.',
      },
      {
        name: 'email',
        type: 'string',
        required: false,
        description: 'Recipient email, only if the person supplied it; for the owner’s records.',
      },
    ],
    examples: ['Make an investor-room link for Anna'],
    enabled: true,
  },
  revoke_investor_room_link: {
    id: 'revoke_investor_room_link',
    name: 'Switch off investor room link',
    category: 'entities',
    icon: Lock,
    description: 'Switch off one recipient’s room link; retain its history.',
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      project,
      {
        name: 'link_id',
        type: 'entity_id',
        required: true,
        description: 'The actual recipient link ID returned by get_investor_room.',
      },
    ],
    examples: ['Switch off Anna’s investor-room link'],
    enabled: true,
  },
  generate_investor_deck: {
    id: 'generate_investor_deck',
    name: 'Generate investor deck',
    category: 'entities',
    icon: FileText,
    description:
      'Generate a sourced investor deck; preserve an existing deck unless replacement is requested.',
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      project,
      {
        name: 'replace_existing',
        type: 'boolean',
        required: false,
        default: false,
        description: 'True only when the person explicitly asks to replace an existing deck.',
      },
    ],
    examples: ['Make a first deck from Heidi’s room'],
    enabled: true,
  },
  save_investor_deck: {
    id: 'save_investor_deck',
    name: 'Save investor deck',
    category: 'entities',
    icon: FileText,
    description: 'Save edited deck data, preserving other slides and evidence bindings.',
    riskLevel: 'medium',
    requiresConfirmation: true,
    parameters: [
      project,
      {
        name: 'deck',
        type: 'object',
        required: true,
        description:
          'The complete edited deck object, in the format returned by get_investor_room.',
      },
    ],
    examples: ['Change the title slide in my investor deck'],
    enabled: true,
  },
};
