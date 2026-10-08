import type { SVGProps } from 'react';

export function LogoMark({ className = 'h-8 w-8', id = 'evlogo', ...props }: SVGProps<SVGSVGElement> & { id?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="0.55" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="8.5" stroke={`url(#${id}-g)`} strokeWidth="1.6" />
      <path
        d="M10.4 10.2 L7.2 16 L10.4 21.8"
        stroke={`url(#${id}-g)`}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 10.6 L12.4 21.4 H17.6 L15.6 25"
        stroke={`url(#${id}-g)`}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.4" cy="12.2" r="2.1" fill="#22D3EE" />
      <path d="M21.4 22.6h4.2" stroke="#60A5FA" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="relative inline-flex">
        <LogoMark className="h-8 w-8" id="brand" />
        <span className="absolute inset-0 -z-10 rounded-xl bg-volt-500/20 blur-lg" />
      </span>
      {!compact ? (
        <span className="leading-none">
          <span className="block text-[13.5px] font-semibold tracking-tight text-ink-50">EVISION AI</span>
          <span className="mt-1 block text-[9.5px] font-medium uppercase tracking-[0.22em] text-ink-500">
            Intelligence Platform
          </span>
        </span>
      ) : null}
    </span>
  );
}
