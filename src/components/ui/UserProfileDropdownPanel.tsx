'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, ExternalLink } from 'lucide-react';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import { IdentitySwitcherRows } from '@/components/ui/IdentitySwitcherRows';
import { ThemeModeRow } from '@/components/ui/ThemeModeRow';
import type { MutableRefObject } from 'react';
import { ROUTES } from '@/config/routes';

export interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  description?: string;
}

interface UserProfileDropdownPanelProps {
  buttonRef: MutableRefObject<HTMLButtonElement | null>;
  close: () => void;
  showUserInfo: boolean;
  showDescriptions: boolean;
  avatarUrl: string | null | undefined;
  avatarError: boolean;
  setAvatarError: (v: boolean) => void;
  displayName: string;
  username: string | null | undefined;
  email: string;
  handlePublicProfileClick: () => void;
  menuItems: MenuItem[];
  itemRefs: MutableRefObject<(HTMLButtonElement | HTMLAnchorElement | null)[]>;
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  isOpen: boolean;
  handleNavigation: (path: string) => void;
  handleSignOut: () => void;
}

export function UserProfileDropdownPanel({
  buttonRef,
  close,
  showUserInfo,
  showDescriptions,
  avatarUrl,
  avatarError,
  setAvatarError,
  displayName,
  username,
  email,
  handlePublicProfileClick,
  menuItems,
  itemRefs,
  focusedIndex,
  setFocusedIndex,
  isOpen,
  handleNavigation,
  handleSignOut,
}: UserProfileDropdownPanelProps) {
  return (
    <div
      className="fixed z-50 rounded-lg shadow-sm bg-surface-base border border-border-subtle animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-200 origin-top-right overflow-hidden"
      style={{
        top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 12 : 'auto',
        right: buttonRef.current
          ? Math.max(16, window.innerWidth - buttonRef.current.getBoundingClientRect().right)
          : 'auto',
        width: Math.min(320, window.innerWidth - 32),
      }}
      role="menu"
      aria-orientation="vertical"
      aria-label="User menu"
    >
      {showUserInfo && (
        <div className="p-6 bg-muted/30 border-b border-border-subtle">
          <div className="flex items-center space-x-4">
            <Link
              href={ROUTES.PROFILES.ME}
              onClick={e => {
                e.stopPropagation();
                close();
              }}
              className="relative hover:opacity-80 transition-opacity"
            >
              {avatarUrl && !avatarError ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={56}
                  height={56}
                  className="rounded-full object-cover ring-4 ring-border-subtle cursor-pointer"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <DefaultAvatar
                  size={56}
                  className="rounded-full ring-4 ring-border-subtle cursor-pointer"
                />
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-status-positive border-3 border-card rounded-full shadow-sm" />
            </Link>
            <div className="flex-1 min-w-0">
              <button
                onClick={handlePublicProfileClick}
                className="group flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-lg p-1 -m-1"
              >
                <h3 className="font-semibold text-lg text-fg-primary group-hover:underline underline-offset-4 truncate">
                  {displayName}
                </h3>
                <ExternalLink className="w-4 h-4 text-muted-dim group-hover:text-fg-primary transition-all duration-200 opacity-0 group-hover:opacity-100 transform group-hover:scale-110" />
              </button>
              {username && <p className="text-sm font-medium text-fg-secondary">@{username}</p>}
              {email && <p className="text-xs text-fg-secondary truncate mt-1">{email}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="py-2" role="none">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              ref={el => {
                itemRefs.current[index] = el;
              }}
              onClick={() => handleNavigation(item.href)}
              onFocus={() => setFocusedIndex(index)}
              role="menuitem"
              tabIndex={isOpen ? 0 : -1}
              className={`
                w-full flex items-center px-4 py-3 text-sm transition-all duration-200 group outline-none
                hover:bg-muted focus:bg-muted/40 dark:focus:bg-muted focus:ring-2 focus:ring-ring focus:ring-inset
                ${focusedIndex === index ? 'bg-muted' : ''}
              `}
            >
              <div className="oc-icon-tile mr-4 h-10 w-10">
                <Icon className="w-5 h-5 text-fg-secondary transition-colors duration-200 group-hover:text-fg-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-fg-primary transition-colors duration-200">
                  {item.label}
                </div>
                {showDescriptions && (
                  <div className="text-sm text-fg-secondary group-hover:text-fg-secondary transition-colors duration-200">
                    {item.description}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <IdentitySwitcherRows />

      <div className="border-t border-border-subtle my-1" />

      {/* Theme lives here so small screens can reach it — the header toggle is
          desktop-only. Not keyboard-indexed with the nav items above because it
          acts in place instead of navigating. */}
      <div className="py-1" role="none">
        <ThemeModeRow showDescription={showDescriptions} />
      </div>

      <div className="border-t border-border-subtle my-1" />

      <div className="py-2">
        <button
          ref={el => {
            itemRefs.current[menuItems.length] = el;
          }}
          onClick={handleSignOut}
          onFocus={() => setFocusedIndex(menuItems.length)}
          role="menuitem"
          tabIndex={isOpen ? 0 : -1}
          className={`
            w-full flex items-center px-4 py-3 text-sm transition-all duration-200 group outline-none
            hover:bg-destructive/10 focus:bg-destructive/10 focus:ring-2 focus:ring-destructive/20 focus:ring-inset
            ${focusedIndex === menuItems.length ? 'bg-destructive/10' : ''}
          `}
        >
          <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10">
            <LogOut className="w-5 h-5 text-destructive transition-transform duration-200 group-hover:scale-110" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-destructive group-hover:text-destructive/80 transition-colors duration-200">
              Sign Out
            </div>
            {showDescriptions && (
              <div className="text-sm text-destructive/70 transition-colors duration-200 group-hover:text-destructive">
                End your session
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
