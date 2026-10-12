// @vitest-environment jsdom
/**
 * "What it solves" as a picker: one scale, then one answer, at a time.
 * It replaced twelve cards of full text; these pin that the visitor can still
 * reach every answer, and that each answer's action is a real registry link.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ProblemsExplorer from '@/components/home/sections/ProblemsExplorer';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { PROBLEM_SCALES } from '@/config/problems-we-solve';

const [people, society] = PROBLEM_SCALES;

describe('ProblemsExplorer', () => {
  it('opens on the first scale with its first problem answered', () => {
    render(<ProblemsExplorer />);
    expect(screen.getByRole('tab', { name: people.title })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    for (const item of people.items) {
      expect(screen.getByRole('button', { name: item.problem })).toBeInTheDocument();
    }
    expect(screen.getAllByText(people.items[0].solution).length).toBeGreaterThan(0);
    expect(screen.queryByText(people.items[1].solution)).toBeNull();
  });

  it('shows the answer to the problem chosen, with its registry action', () => {
    render(<ProblemsExplorer />);
    const item = people.items[1];
    fireEvent.click(screen.getByRole('button', { name: item.problem }));
    expect(screen.getByRole('button', { name: item.problem })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    const answers = screen.getAllByText(item.solution);
    expect(answers.length).toBeGreaterThan(0);
    const meta = ENTITY_REGISTRY[item.entityType];
    const panel = answers[0].closest('div') as HTMLElement;
    expect(within(panel).getByRole('link', { name: meta.plain.verb })).toHaveAttribute(
      'href',
      meta.createPath
    );
  });

  it('switches scale and starts that scale at its first problem', () => {
    render(<ProblemsExplorer />);
    fireEvent.click(screen.getByRole('tab', { name: society.title }));
    expect(screen.getByRole('tab', { name: society.title })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('button', { name: people.items[0].problem })).toBeNull();
    expect(screen.getAllByText(society.items[0].solution).length).toBeGreaterThan(0);
  });
});
