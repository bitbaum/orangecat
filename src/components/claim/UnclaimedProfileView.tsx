/**
 * The public page of a person who has not accepted it yet.
 *
 * ADR-0005 D4/D7. `/profiles/<slug>` resolves here when no `profiles.username`
 * matches but an unclaimed placeholder owns that slug. It is deliberately
 * sparse: a name, whatever the steward filled in, and the things set up for
 * them. Empty is honest — this is what a friend could say about her in five
 * minutes, and the rest is hers to write once she takes it over.
 *
 * There is no Fund button anywhere on it. A placeholder cannot hold a wallet
 * (the database refuses), so offering one would promise an action that can
 * never complete.
 */

import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { APP_NAME } from '@/config/brand';
import { UnclaimedBand } from './UnclaimedBand';

export interface UnclaimedProfileEntity {
  id: string;
  title: string;
  description: string | null;
}

export function UnclaimedProfileView({
  name,
  avatarUrl,
  stewardUsername,
  projects,
}: {
  name: string;
  avatarUrl: string | null;
  stewardUsername: string | null;
  projects: UnclaimedProfileEntity[];
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-surface-page">
      <UnclaimedBand ownerName={name} stewardUsername={stewardUsername} />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-full border border-default bg-surface-raised">
            {avatarUrl ? (
              // The steward pastes an arbitrary URL; next/image needs an
              // allowlisted host, which an arbitrary photo will not be.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-heading text-2xl text-fg-secondary">
                {initial}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-display text-fg-primary">
              {name}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">Not on {APP_NAME} yet</p>
          </div>
        </div>

        {projects.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-caps text-fg-muted">
              Set up for {name.split(' ')[0]}
            </h2>
            <ul className="mt-3 space-y-3">
              {projects.map(project => (
                <li key={project.id}>
                  <Link
                    href={ROUTES.PROJECTS.VIEW(project.id)}
                    className="block rounded-lg border border-default bg-surface-base p-4 transition-colors hover:bg-surface-raised"
                  >
                    <p className="font-medium text-fg-primary">{project.title}</p>
                    {project.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">
                        {project.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-sm text-fg-muted">
          {name} hasn’t taken this over yet, so nothing here can receive funds. If you know{' '}
          {name.split(' ')[0]}, send them the link they were given — it’s theirs to accept.
        </p>
      </div>
    </div>
  );
}
