import type { ReactNode } from 'react';

/**
 * The console's line icons: a 24 grid, a 1.75 stroke and round ends (D6). They are decoration:
 * every icon sits beside a visible text label, so each one is hidden from screen readers. Colour
 * comes from `currentColor`, so no colour is written here.
 */
const PATHS = {
  /** A circle of seven: the Quran circle. */
  halaqa:
    '<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="4.5" r="1.6"/><circle cx="12" cy="19.5" r="1.6"/><circle cx="5.5" cy="8.2" r="1.6"/><circle cx="18.5" cy="8.2" r="1.6"/><circle cx="5.5" cy="15.8" r="1.6"/><circle cx="18.5" cy="15.8" r="1.6"/>',
  masjid:
    '<path d="M7.2 13.2c0-3.1 2.2-5.2 4.8-6.6 2.6 1.4 4.8 3.5 4.8 6.6"/><path d="M12 6.6V4"/><path d="M6.2 13.2h11.6V21H6.2z"/><path d="M10.4 21v-2.6a1.6 1.6 0 0 1 3.2 0V21"/><path d="M2.8 21V10.2l1-1.9 1 1.9V21"/><path d="M19.2 21V10.2l1-1.9 1 1.9V21"/><path d="M2 21h20"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.6 3-5.6 6-5.6s5.5 2 6 5.6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.6c1.8.7 2.9 2.5 3.2 5.4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  log: '<path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8v.1"/>',
  alert: '<path d="M12 4 3 19.5h18z"/><path d="M12 10v4.5"/><path d="M12 17.4v.1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  /** An open book: the Quran, for the ayah of the day. */
  book: '<path d="M3 5.5c3-1.2 6-1 9 1 3-2 6-2.2 9-1V19c-3-1.2-6-1-9 1-3-2-6-2.2-9-1z"/><path d="M12 6.5V20"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 'md' }: { name: IconName; size?: 'sm' | 'md' }) {
  return (
    <svg
      className={`icon icon-${size}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}

/** The eight-point star: two squares, one turned a quarter. Stroked in `currentColor`. */
export function EightPointStar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    >
      <rect x="5" y="5" width="14" height="14" rx="1" />
      <rect x="5" y="5" width="14" height="14" rx="1" transform="rotate(45 12 12)" />
    </svg>
  );
}

/**
 * The eight-point pattern that runs through the green sidebar and the green sheet tops (D15).
 * Strokes are `currentColor` at low opacity (set in CSS), so it follows the text-on-green colour.
 */
export function PatternLayer() {
  return (
    <svg className="pattern" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="qc-eight-point" width="40" height="40" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="11" y="11" width="18" height="18" />
            <rect x="11" y="11" width="18" height="18" transform="rotate(45 20 20)" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#qc-eight-point)" />
    </svg>
  );
}

/** A filled eight-point star shape for the icon badge on careful dialogs (D13). */
export function StarBadge({ children }: { children: ReactNode }) {
  return (
    <span className="star-badge" aria-hidden="true">
      <svg viewBox="0 0 100 100" focusable="false">
        <polygon points="50,0 64.6,14.6 85.4,14.6 85.4,35.4 100,50 85.4,64.6 85.4,85.4 64.6,85.4 50,100 35.4,85.4 14.6,85.4 14.6,64.6 0,50 14.6,35.4 14.6,14.6 35.4,14.6" />
      </svg>
      <span className="star-badge-icon">{children}</span>
    </span>
  );
}
