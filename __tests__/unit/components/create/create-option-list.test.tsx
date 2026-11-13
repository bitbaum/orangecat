// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateOptionList } from '@/components/create/CreateOptionList';
import { CREATE_PAGE, CREATE_RAISE_ROW } from '@/config/create-options';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

describe('the one create list (/create, phone sheet, header menu)', () => {
  it('starts with the need-first row and ends with the way to the full map', () => {
    render(<CreateOptionList />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', CREATE_RAISE_ROW.href);
    expect(links[links.length - 1]).toHaveTextContent(CREATE_PAGE.browseAll);
  });

  it('a row says what you came to do, with the type name beside it', () => {
    render(<CreateOptionList />);
    const row = screen.getByRole('link', {
      name: new RegExp(ENTITY_REGISTRY.product.plain.verb),
    });
    expect(row).toHaveAttribute('href', ENTITY_REGISTRY.product.createPath);
    expect(row).toHaveTextContent(ENTITY_REGISTRY.product.name);
  });

  it('closes its host when a row is chosen', () => {
    const onNavigate = vi.fn();
    render(<CreateOptionList onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: new RegExp(CREATE_RAISE_ROW.title) }));
    expect(onNavigate).toHaveBeenCalled();
  });
});
