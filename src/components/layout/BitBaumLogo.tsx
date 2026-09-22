'use client';

import Link from 'next/link';

export default function BitBaumLogo({
  className = '',
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <Link
      href="https://bitbaum.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center space-x-2 group ${className}`.trim()}
      aria-label="bitbaum - the studio behind OrangeCat and Loki"
    >
      {/* BitBaum Tree Logo */}
      <span className="inline-block w-8 h-8 flex-shrink-0">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Tree trunk */}
          <rect x="14" y="20" width="4" height="10" fill="#8B4513" rx="2" />

          {/* Tree crown - layered circles for depth */}
          <circle cx="16" cy="12" r="8" fill="#228B22" />
          <circle cx="16" cy="10" r="6" fill="#32CD32" />
          <circle cx="16" cy="8" r="4" fill="#90EE90" />

          {/* Bitcoin symbol integrated into tree */}
          <g transform="translate(12, 6)">
            <path
              d="M4 2C4 1.44772 4.44772 1 5 1H7C7.55228 1 8 1.44772 8 2V6H9V8H8V9H6V8H4V6H5V2.5C5 2.22386 4.77614 2 4.5 2C4.22386 2 4 2.22386 4 2.5V6H2V8H1V6H2V2Z"
              fill="#F7931A"
            />
          </g>
        </svg>
      </span>

      {showText && (
        <span className="text-lg font-bold text-fg-primary group-hover:underline underline-offset-4">
          bitbaum
        </span>
      )}
    </Link>
  );
}
