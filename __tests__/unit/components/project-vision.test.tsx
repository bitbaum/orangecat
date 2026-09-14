// @vitest-environment jsdom
/**
 * A project page said what the work IS and what is happening on it NOW, and
 * never where it ENDS UP. `vision` is that third statement, and this is the
 * instance behind scripts/check-dead-fields.mjs: a field the create form
 * collects has to appear on a page someone can read, or it is data the owner
 * typed into a hole.
 *
 * Both directions matter. Present → the section renders. Absent → the section
 * is gone rather than an empty heading, because a project that has not written
 * a vision should not look like one that wrote nothing.
 */

import { render, screen } from '@testing-library/react';

vi.mock('@/components/project/ProjectDonationSection', () => ({
  ProjectDonationSection: () => <div data-testid="donation-section" />,
}));

vi.mock('@/components/project/ProjectUpdatesTimeline', () => ({
  ProjectUpdatesTimeline: () => <div data-testid="updates-timeline" />,
}));

vi.mock('@/components/ui/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ amount }: { amount: number }) => <span>{amount}</span>,
}));

import ProjectContent from '@/components/project/ProjectContent';

const base = {
  id: 'proj-1',
  title: 'Loki',
  description: 'The production layer.',
  funding_purpose: null,
  website_url: null,
  category: null,
  tags: null,
  goal_amount: null,
  raised_amount: null,
  currency: 'CHF',
  bitcoin_address: null,
  lightning_address: null,
};

describe('project vision', () => {
  it('shows the end state the project is building toward', () => {
    render(
      <ProjectContent
        project={{ ...base, vision: 'A world where anyone can build what they can describe.' }}
      />
    );

    expect(screen.getByText('Where this is going')).toBeInTheDocument();
    expect(
      screen.getByText('A world where anyone can build what they can describe.')
    ).toBeInTheDocument();
  });

  it('renders no vision section when the owner has not written one', () => {
    render(<ProjectContent project={{ ...base, vision: null }} />);

    expect(screen.queryByText('Where this is going')).not.toBeInTheDocument();
  });

  it('keeps the vision distinct from the current status', () => {
    render(
      <ProjectContent
        project={{
          ...base,
          vision: 'Anyone can build what they can describe.',
          work_status: 'Wiring the approval boundary.',
        }}
      />
    );

    expect(screen.getByText('Where this is going')).toBeInTheDocument();
    expect(screen.getByText('Current status')).toBeInTheDocument();
    expect(screen.getByText('Anyone can build what they can describe.')).toBeInTheDocument();
    expect(screen.getByText('Wiring the approval boundary.')).toBeInTheDocument();
  });
});
