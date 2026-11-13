'use client';

import React from 'react';
import { ChevronDown, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessagingActor } from '@/features/messaging/hooks/useMessagingActors';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface MessageActorSelectorProps {
  selectedActor: MessagingActor;
  selectedActorId: string | null;
  personalActor: MessagingActor | null;
  groupActors: MessagingActor[];
  onSelectActor: (id: string | null) => void;
}

export function MessageActorSelector({
  selectedActor,
  selectedActorId,
  personalActor,
  groupActors,
  onSelectActor,
}: MessageActorSelectorProps) {
  return (
    <div className="flex items-center gap-2 px-3 pt-1 text-sm text-fg-secondary">
      <span>Sending as</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="-my-1 flex min-h-11 items-center gap-1.5 rounded-full px-2 font-medium text-fg-primary hover:bg-surface-raised transition-colors"
          >
            <Avatar className="h-5 w-5">
              <AvatarImage src={selectedActor.avatar_url || undefined} />
              <AvatarFallback className="text-[8px]">
                {selectedActor.actor_type === 'group' ? (
                  <Users className="h-2.5 w-2.5" />
                ) : (
                  <User className="h-2.5 w-2.5" />
                )}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-fg-primary">{selectedActor.name}</span>
            <ChevronDown className="h-3 w-3 text-fg-tertiary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Send message as</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {personalActor && (
            <DropdownMenuItem
              onClick={() => onSelectActor(null)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                (!selectedActorId || selectedActorId === personalActor.actor_id) &&
                  'bg-surface-raised'
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={personalActor.avatar_url || undefined} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">{personalActor.name}</p>
                <p className="text-xs text-fg-secondary">Personal account</p>
              </div>
            </DropdownMenuItem>
          )}
          {groupActors.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-fg-secondary">
                Organizations
              </DropdownMenuLabel>
              {groupActors.map(actor => (
                <DropdownMenuItem
                  key={actor.actor_id}
                  onClick={() => onSelectActor(actor.actor_id)}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    selectedActorId === actor.actor_id && 'bg-surface-raised'
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={actor.avatar_url || undefined} />
                    <AvatarFallback>
                      <Users className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{actor.name}</p>
                    <p className="text-xs text-fg-secondary">Organization</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
