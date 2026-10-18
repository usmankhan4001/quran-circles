import type { ReactNode } from 'react';
import {
  BookOpenTextIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  DownloadSimpleIcon,
  FileCsvIcon,
  InfoIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MoonStarsIcon,
  MosqueIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  QrCodeIcon,
  ScrollIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TicketIcon,
  TranslateIcon,
  UploadSimpleIcon,
  UsersThreeIcon,
  WarningCircleIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';

/**
 * The console's icons are the showcase's Phosphor icons (owner override of D17, 2026-10-18), drawn
 * from `@phosphor-icons/react` in the four Phosphor weights. They are decoration: every icon sits
 * beside a visible text label, so each one is hidden from screen readers. Colour comes from
 * `currentColor`, so no colour is written here.
 */
const ICONS = {
  'book-open-text': BookOpenTextIcon,
  'calendar-blank': CalendarBlankIcon,
  'check-circle': CheckCircleIcon,
  check: CheckIcon,
  clock: ClockIcon,
  'download-simple': DownloadSimpleIcon,
  'file-csv': FileCsvIcon,
  info: InfoIcon,
  'magnifying-glass': MagnifyingGlassIcon,
  'map-pin': MapPinIcon,
  'moon-stars': MoonStarsIcon,
  mosque: MosqueIcon,
  'paper-plane-tilt': PaperPlaneTiltIcon,
  plus: PlusIcon,
  'qr-code': QrCodeIcon,
  scroll: ScrollIcon,
  'shield-check': ShieldCheckIcon,
  'sliders-horizontal': SlidersHorizontalIcon,
  ticket: TicketIcon,
  translate: TranslateIcon,
  'upload-simple': UploadSimpleIcon,
  'users-three': UsersThreeIcon,
  'warning-circle': WarningCircleIcon,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;
export type IconWeight = 'regular' | 'bold' | 'fill' | 'duotone';

const SIZES = { sm: 14, md: 18 } as const;

export function Icon({
  name,
  size = 'md',
  weight = 'regular',
}: {
  name: IconName;
  /** A preset, or the artboard's pixel size (scaled with the text size as rem). */
  size?: keyof typeof SIZES | number;
  weight?: IconWeight;
}) {
  const Glyph = ICONS[name];
  const px = typeof size === 'number' ? size : SIZES[size];
  return (
    <Glyph
      className="icon"
      size={`${px / 16}rem`}
      weight={weight}
      aria-hidden="true"
      focusable="false"
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
