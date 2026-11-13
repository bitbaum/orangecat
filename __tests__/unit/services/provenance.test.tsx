// @vitest-environment jsdom
/**
 * What the Cat or a bot made carries its name: the executor records the maker
 * of every entity a `create_<type>` action makes, and the page shows it.
 */
import { render, screen } from '@testing-library/react';

const upsert = vi.fn();
let conversationRow: { assistant_id: string } | null = null;

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      if (table === 'entity_provenance') {
        return { upsert: (...args: unknown[]) => (upsert(...args), { error: null }) };
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: table === 'ai_conversations' ? conversationRow : null }),
      };
      return chain;
    },
  }),
}));

import { createdEntityId, createdEntityType, recordProvenance } from '@/services/provenance';
import { MadeWithByline } from '@/components/public/MadeWithChip';

beforeEach(() => {
  upsert.mockReset();
  conversationRow = null;
});

describe('which actions make an entity', () => {
  it('reads the type from the registry, not a list', () => {
    expect(createdEntityType('create_product')).toBe('product');
    expect(createdEntityType('create_ai_assistant')).toBe('ai_assistant');
    expect(createdEntityType('create_project_for_person')).toBeNull();
    expect(createdEntityType('create_task')).toBeNull();
    expect(createdEntityType('send_payment')).toBeNull();
  });

  it('takes the id from the inserted row', () => {
    expect(createdEntityId({ id: 'p-1', title: 'x' })).toBe('p-1');
    expect(createdEntityId({ displayMessage: 'done' })).toBeNull();
    expect(createdEntityId(undefined)).toBeNull();
  });
});

describe('recordProvenance', () => {
  it('records the Cat when the conversation is not a bot conversation', async () => {
    await recordProvenance({
      actionId: 'create_product',
      userId: 'u-1',
      conversationId: 'cat-conv',
      data: { id: 'p-1' },
    });
    expect(upsert).toHaveBeenCalledWith(
      {
        entity_type: 'product',
        entity_id: 'p-1',
        made_by: 'cat',
        made_with_assistant_id: null,
      },
      expect.objectContaining({ onConflict: 'entity_type,entity_id' })
    );
  });

  it('records the bot whose conversation proposed it', async () => {
    conversationRow = { assistant_id: 'bot-1' };
    await recordProvenance({
      actionId: 'create_service',
      userId: 'u-1',
      conversationId: 'bot-conv',
      data: { id: 's-1' },
    });
    expect(upsert.mock.calls[0][0]).toMatchObject({
      entity_type: 'service',
      made_by: 'bot',
      made_with_assistant_id: 'bot-1',
    });
  });

  it('records nothing for an action that makes no entity', async () => {
    await recordProvenance({ actionId: 'send_message', userId: 'u-1', data: { id: 'm-1' } });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('the byline', () => {
  it('names a public bot and links to it', () => {
    render(
      <MadeWithByline
        provenance={{ madeBy: 'bot', bot: { id: 'b-1', name: 'Mira', avatarUrl: null } }}
      />
    );
    const link = screen.getByRole('link', { name: /Made with Mira/ });
    expect(link.getAttribute('href')).toBe('/companions/b-1');
  });

  it('says Cat for the Cat', () => {
    render(<MadeWithByline provenance={{ madeBy: 'cat', bot: null }} />);
    expect(screen.getByRole('link', { name: 'Made with Cat' })).toBeTruthy();
  });

  it('does not name a private bot', () => {
    render(<MadeWithByline provenance={{ madeBy: 'bot', bot: null }} />);
    expect(screen.getByText('Made with a bot')).toBeTruthy();
  });

  it('shows nothing for work made by hand', () => {
    const { container } = render(<MadeWithByline provenance={null} />);
    expect(container.textContent).toBe('');
  });
});
