'use client';

/** Minimal VS Code–style strokes (not full codicons) for the activity bar. */

const S = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.45 } as const;

export function IconExplorer() {
  return (
    <svg {...S} aria-hidden>
      <path d="M9 4h10v16H9V4z" strokeLinejoin="round" />
      <path d="M5 8H9v12H5V8z" strokeLinejoin="round" />
      <path d="M5 8V6h4v2" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg {...S} aria-hidden>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSourceControl() {
  return (
    <svg {...S} aria-hidden>
      <circle cx="9" cy="8" r="2.2" />
      <path d="M9 10v8M9 18h6M15 14v4" strokeLinecap="round" />
      <path d="M15 6h3v12H6V6h3" strokeLinejoin="round" />
    </svg>
  );
}

export function IconRunDebug() {
  return (
    <svg {...S} aria-hidden>
      <path d="M8 5l10 7-10 7V5z" strokeLinejoin="round" />
      <path d="M5 19V5" strokeLinecap="round" />
    </svg>
  );
}

export function IconExtensions() {
  return (
    <svg {...S} aria-hidden>
      <rect x="5" y="5" width="6" height="6" rx="1" strokeLinejoin="round" />
      <rect x="13" y="5" width="6" height="6" rx="1" strokeLinejoin="round" />
      <rect x="5" y="13" width="6" height="6" rx="1" strokeLinejoin="round" />
      <rect x="13" y="13" width="6" height="6" rx="1" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAccount() {
  return (
    <svg {...S} aria-hidden>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M6 20c0-4 3.5-6 6-6s6 2 6 6" strokeLinecap="round" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg {...S} aria-hidden>
      <circle cx="12" cy="12" r="3" strokeLinejoin="round" />
      <path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconFile() {
  return (
    <svg {...S} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFolder() {
  return (
    <svg {...S} aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeLinejoin="round" />
    </svg>
  );
}
