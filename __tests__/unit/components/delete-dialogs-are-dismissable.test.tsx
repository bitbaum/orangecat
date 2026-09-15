// @vitest-environment jsdom
/**
 * The two irreversible actions on the timeline behaved differently.
 *
 * DeletePostDialog hand-rolled an Escape handler and a body-scroll lock, and
 * still had no focus trap. BulkDeleteConfirmDialog was a bare `fixed inset-0`
 * div: no Escape, no scroll lock, no trap — a keyboard user could not dismiss
 * it at all. Both now render through ConfirmDialog (Radix), which provides all
 * three, so this pins the behaviour rather than the markup.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { DeletePostDialog } from '@/components/timeline/DeletePostDialog';
import { BulkDeleteConfirmDialog } from '@/components/timeline/BulkDeleteConfirmDialog';

describe('DeletePostDialog', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<DeletePostDialog isOpen onClose={onClose} onConfirm={async () => {}} />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows what is about to be deleted when a preview is given', () => {
    render(
      <DeletePostDialog
        isOpen
        onClose={() => {}}
        onConfirm={async () => {}}
        postPreview="the post being removed"
      />
    );
    expect(screen.getByText('the post being removed')).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    render(<DeletePostDialog isOpen={false} onClose={() => {}} onConfirm={async () => {}} />);
    expect(screen.queryByText('Delete post?')).toBeNull();
  });
});

describe('BulkDeleteConfirmDialog', () => {
  it('closes on Escape — it previously could not be dismissed by keyboard at all', () => {
    const onCancel = vi.fn();
    render(
      <BulkDeleteConfirmDialog
        count={3}
        isProcessing={false}
        onCancel={onCancel}
        onConfirm={() => {}}
      />
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('counts correctly in singular and plural', () => {
    const { rerender } = render(
      <BulkDeleteConfirmDialog
        count={1}
        isProcessing={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Delete 1 post?')).toBeInTheDocument();
    rerender(
      <BulkDeleteConfirmDialog
        count={4}
        isProcessing={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Delete 4 posts?')).toBeInTheDocument();
  });

  it('disables both buttons while the delete is in flight', () => {
    render(
      <BulkDeleteConfirmDialog count={2} isProcessing onCancel={() => {}} onConfirm={() => {}} />
    );
    expect(screen.getByRole('button', { name: /Deleting/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
