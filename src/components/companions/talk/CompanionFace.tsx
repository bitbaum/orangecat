'use client';

/**
 * A companion's face in the list and the header: its picture when it has
 * one, otherwise the face its name picks (config/companion-avatars.ts). A
 * group chat wears the faces of its first two members, one over the other.
 */

import Image from 'next/image';
import { faceForName } from '@/config/companion-avatars';

export function Face({
  name,
  avatarUrl,
  size = 48,
  className = '',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  const { shape, hue } = faceForName(name);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={shape.d} fill={hue.fill} />
      <g fill="#FFFFFF" fillOpacity="0.96">
        <rect x="38" y="38" width="8" height="18" rx="4" transform="rotate(-10 42 47)" />
        <rect x="56" y="38" width="8" height="18" rx="4" transform="rotate(-10 60 47)" />
      </g>
    </svg>
  );
}

/** Two faces, one over the other: a group. */
export function GroupFaces({
  members,
  size = 48,
}: {
  members: ReadonlyArray<{ name: string; avatarUrl?: string | null }>;
  size?: number;
}) {
  const [a, b] = members;
  const small = Math.round(size * 0.68);
  if (!a) {
    return <Face name="?" size={size} />;
  }
  if (!b) {
    return <Face name={a.name} avatarUrl={a.avatarUrl} size={size} />;
  }
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }}>
      <span className="absolute left-0 top-0">
        <Face name={a.name} avatarUrl={a.avatarUrl} size={small} />
      </span>
      <span className="absolute bottom-0 right-0 rounded-full ring-2 ring-surface-page">
        <Face name={b.name} avatarUrl={b.avatarUrl} size={small} />
      </span>
    </span>
  );
}
