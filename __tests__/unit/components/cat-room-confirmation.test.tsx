// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingActionsCard } from '@/components/ai-chat/PendingActionsCard';

it('lets the person review complete nested room content before confirming', () => {
  const body = 'A sourced paragraph that must remain readable in full. '.repeat(5);
  render(
    <PendingActionsCard
      action={{
        id: 'pending-one',
        actionId: 'save_investor_room',
        category: 'entities',
        description: 'Update the investor room',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        parameters: {
          project_id: 'project-one',
          content: { headline: 'A clear story', sections: [{ title: 'The ask', body }] },
        },
      }}
      onConfirm={vi.fn()}
      onReject={vi.fn()}
    />
  );
  fireEvent.click(screen.getByText('Details'));
  expect(screen.getByText('A clear story')).toBeInTheDocument();
  expect(screen.getByText('The ask')).toBeInTheDocument();
  expect(screen.getByText(body.trim())).toBeInTheDocument();
  expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Confirm/ })).toBeEnabled();
});
