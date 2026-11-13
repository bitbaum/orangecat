// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormHeader } from '@/components/create/EntityForm/components/FormHeader';
import { groupConfig } from '@/config/entity-configs/group-config';
import { loanConfig } from '@/config/entity-configs/loan-config';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

describe('create pages share one header frame', () => {
  it('breadcrumb back to the list, the title, the description, the actions', () => {
    render(
      <FormHeader
        name="Product"
        namePlural="Products"
        pageDescription="Sell something"
        backUrl="/dashboard/store"
        mode="create"
        actions={<button type="button">Owner</button>}
      />
    );
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/dashboard/store'
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Create Product' }).className).toMatch(
      /oc-page-title/
    );
    expect(screen.getByText('Sell something')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Owner' })).toBeInTheDocument();
  });
});

describe('a type has one name from chooser to form', () => {
  it('the organisation form uses the registry name', () => {
    expect(groupConfig.name).toBe(ENTITY_REGISTRY.group.name);
    expect(groupConfig.pageTitle).toBe(`Create ${ENTITY_REGISTRY.group.name}`);
    expect(groupConfig.pageDescription).toBe(ENTITY_REGISTRY.group.plain.what);
  });

  it('a loan is created as a loan', () => {
    expect(loanConfig.pageTitle).toBe('Create Loan');
  });
});
