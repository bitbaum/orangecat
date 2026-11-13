'use client';

import type { ElementType } from 'react';
import { Lock } from 'lucide-react';
import EntityDetailLayout from '@/components/entity/EntityDetailLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';

interface GroupMembersOnlyProps {
  name: string;
  slug: string;
  labelName: string;
  LabelIcon: ElementType;
  signedIn: boolean;
}

/**
 * What someone outside a "Members only" or private group sees: its name, its
 * label, and that the rest is for members. Signed out, the way in is to sign
 * in; signed in, joining such a group takes an invitation.
 */
export function GroupMembersOnly({
  name,
  slug,
  labelName,
  LabelIcon,
  signedIn,
}: GroupMembersOnlyProps) {
  const signInHref = `${ROUTES.AUTH_LOGIN}&from=${encodeURIComponent(ROUTES.GROUPS.VIEW(slug))}`;

  return (
    <EntityDetailLayout
      title={name}
      left={
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6">
            <Badge variant="secondary" className="gap-1">
              <LabelIcon className="h-4 w-4" aria-hidden="true" />
              {labelName}
            </Badge>
            <p className="mb-0 flex items-center gap-2 text-fg-primary">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              Only members see this group&apos;s content.
            </p>
            {signedIn ? (
              <p className="mb-0 text-fg-secondary">To join, ask the group for an invitation.</p>
            ) : (
              <>
                <p className="mb-0 text-fg-secondary">If you are a member, sign in to see it.</p>
                <Button href={signInHref}>Sign in</Button>
              </>
            )}
          </CardContent>
        </Card>
      }
    />
  );
}
