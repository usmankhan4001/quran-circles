import React from 'react';

export type PhWeight = 'regular' | 'bold' | 'fill' | 'duotone';

export interface PhIconProps {
  /** Phosphor icon slug, e.g. 'mosque', 'book-open-text', 'map-pin', 'compass', 'bell' */
  name: string;
  weight?: PhWeight;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders an authentic Phosphor Icon (@phosphor-icons/web v2.1.1) in any of the 4 weights:
 * - 'regular' (1.5px clean UI stroke)
 * - 'bold' (2px high-contrast action stroke)
 * - 'fill' (solid active tab / badge fill)
 * - 'duotone' (signature two-tone emerald/amber feature & category icon)
 */
export function PhIcon({
  name,
  weight = 'regular',
  size = 20,
  color,
  className = '',
  style,
}: PhIconProps) {
  const prefix =
    weight === 'regular'
      ? 'ph'
      : weight === 'bold'
        ? 'ph-bold'
        : weight === 'fill'
          ? 'ph-fill'
          : 'ph-duotone';

  return (
    <i
      className={`${prefix} ph-${name} ${className}`.trim()}
      style={{
        fontSize: size,
        lineHeight: 1,
        color: color ?? 'currentColor',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Complete mapping of @qc/ui semantic icon tokens -> Phosphor Icon slugs & recommended weights
 */
export interface IconMappingEntry {
  qcToken: string;
  phSlug: string;
  category: 'Navigation' | 'Quran & Worship' | 'Circles & Venues' | 'Facilities' | 'Actions & Status' | 'Admin & Console';
  defaultWeight: PhWeight;
  usage: string;
}

export const PHOSPHOR_ICON_CATALOG: IconMappingEntry[] = [
  // Navigation
  { qcToken: 'home', phSlug: 'house', category: 'Navigation', defaultWeight: 'duotone', usage: 'Home tab (fill when active)' },
  { qcToken: 'nearby', phSlug: 'compass', category: 'Navigation', defaultWeight: 'duotone', usage: 'Nearby / Discover circles tab' },
  { qcToken: 'quran', phSlug: 'book-open-text', category: 'Navigation', defaultWeight: 'duotone', usage: 'Quran & Mushaf reader tab' },
  { qcToken: 'journey', phSlug: 'bookmarks', category: 'Navigation', defaultWeight: 'duotone', usage: 'My Journey & saved circles tab' },
  { qcToken: 'profile', phSlug: 'user-circle', category: 'Navigation', defaultWeight: 'duotone', usage: 'User profile & settings' },
  // Quran & Worship
  { qcToken: 'mosque', phSlug: 'mosque', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Masjid / Venue identity & Prayer strip' },
  { qcToken: 'qibla', phSlug: 'navigation-arrow', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Qibla direction & bearing' },
  { qcToken: 'fajr', phSlug: 'sun-horizon', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Fajr & Maghrib horizon prayer icon' },
  { qcToken: 'dhuhr', phSlug: 'sun', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Dhuhr zenith sun prayer icon' },
  { qcToken: 'asr', phSlug: 'cloud-sun', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Asr afternoon prayer icon' },
  { qcToken: 'isha', phSlug: 'moon-stars', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Isha night prayer & Ramadan mode' },
  { qcToken: 'audio', phSlug: 'waveform', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Reciter audio & tilawah playback' },
  { qcToken: 'memorise', phSlug: 'brain', category: 'Quran & Worship', defaultWeight: 'duotone', usage: 'Hifz / Memorisation tracker' },
  // Circles & Venues
  { qcToken: 'pin', phSlug: 'map-pin', category: 'Circles & Venues', defaultWeight: 'duotone', usage: 'Venue location & map markers' },
  { qcToken: 'route', phSlug: 'path', category: 'Circles & Venues', defaultWeight: 'regular', usage: 'Directions to Masjid CTA' },
  { qcToken: 'calendar', phSlug: 'calendar-blank', category: 'Circles & Venues', defaultWeight: 'duotone', usage: 'Session occurrences & schedule' },
  { qcToken: 'clock', phSlug: 'clock', category: 'Circles & Venues', defaultWeight: 'regular', usage: 'Start time & duration' },
  { qcToken: 'people', phSlug: 'users-three', category: 'Circles & Venues', defaultWeight: 'duotone', usage: 'Community readers & mixed section' },
  { qcToken: 'brothers', phSlug: 'user', category: 'Circles & Venues', defaultWeight: 'duotone', usage: 'Brothers section tag' },
  { qcToken: 'sisters', phSlug: 'sparkle', category: 'Circles & Venues', defaultWeight: 'duotone', usage: 'Sisters section tag' },
  { qcToken: 'families', phSlug: 'users-four', category: 'Circles & Venues', defaultWeight: 'duotone', usage: 'Families section tag' },
  { qcToken: 'online', phSlug: 'video-camera', category: 'Circles & Venues', defaultWeight: 'duotone', usage: 'Online / Hybrid circle stream' },
  // Facilities
  { qcToken: 'wudu', phSlug: 'drop', category: 'Facilities', defaultWeight: 'duotone', usage: 'Wudu / Ablution area available' },
  { qcToken: 'parking', phSlug: 'car-profile', category: 'Facilities', defaultWeight: 'duotone', usage: 'On-site parking available' },
  { qcToken: 'wheelchair', phSlug: 'wheelchair', category: 'Facilities', defaultWeight: 'duotone', usage: 'Step-free wheelchair access' },
  { qcToken: 'ac', phSlug: 'wind', category: 'Facilities', defaultWeight: 'duotone', usage: 'Air-conditioned prayer hall' },
  { qcToken: 'sistersArea', phSlug: 'door-open', category: 'Facilities', defaultWeight: 'duotone', usage: 'Dedicated Sisters entrance & hall' },
  // Actions & Status
  { qcToken: 'search', phSlug: 'magnifying-glass', category: 'Actions & Status', defaultWeight: 'regular', usage: 'Search masjids, surahs, areas' },
  { qcToken: 'filter', phSlug: 'sliders-horizontal', category: 'Actions & Status', defaultWeight: 'regular', usage: 'Filter bottom sheet trigger' },
  { qcToken: 'bell', phSlug: 'bell-ringing', category: 'Actions & Status', defaultWeight: 'duotone', usage: 'Coordinator updates & reminders' },
  { qcToken: 'share', phSlug: 'share-network', category: 'Actions & Status', defaultWeight: 'regular', usage: 'Share circle or ayah card' },
  { qcToken: 'phone', phSlug: 'phone-call', category: 'Actions & Status', defaultWeight: 'regular', usage: 'Contact coordinator' },
  { qcToken: 'check', phSlug: 'check-circle', category: 'Actions & Status', defaultWeight: 'fill', usage: 'Registered / Goal met / Verified' },
  { qcToken: 'warning', phSlug: 'warning-circle', category: 'Actions & Status', defaultWeight: 'fill', usage: 'Waitlist / Room change alert' },
  { qcToken: 'offline', phSlug: 'cloud-slash', category: 'Actions & Status', defaultWeight: 'duotone', usage: 'Offline saved schedule banner' },
  // Admin & Console
  { qcToken: 'attendance', phSlug: 'clipboard-text', category: 'Admin & Console', defaultWeight: 'duotone', usage: 'Coordinator attendance headcount' },
  { qcToken: 'megaphone', phSlug: 'megaphone', category: 'Admin & Console', defaultWeight: 'duotone', usage: 'Post update to circle followers' },
  { qcToken: 'poster', phSlug: 'file-pdf', category: 'Admin & Console', defaultWeight: 'duotone', usage: 'Generate WhatsApp / A4 masjid poster' },
  { qcToken: 'import', phSlug: 'file-csv', category: 'Admin & Console', defaultWeight: 'duotone', usage: 'Bulk CSV schedule import' },
  { qcToken: 'audit', phSlug: 'shield-check', category: 'Admin & Console', defaultWeight: 'duotone', usage: 'Console audit log & verification' },
];

/**
 * 1. Scalloped 8-Pointed Rub el Hizb Ayah Medallion (`StarNumber` in @qc/ui)
 */
export function AyahMedallion({ number, size = 30 }: { number: number | string; size?: number }) {
  return (
    <span
      className="qc-ayah-medallion"
      style={{ width: size, height: size }}
      title={`Ayah ${number}`}
    >
      <svg viewBox="0 0 36 36" width={size} height={size} fill="none">
        <rect
          x="7"
          y="7"
          width="22"
          height="22"
          rx="2.5"
          stroke="#C68A12"
          strokeWidth="1.35"
          fill="#FFFDF7"
        />
        <rect
          x="7"
          y="7"
          width="22"
          height="22"
          rx="2.5"
          transform="rotate(45 18 18)"
          stroke="#186A4B"
          strokeWidth="1.35"
          fill="#F3FBF7"
        />
        <circle cx="18" cy="18" r="9.5" fill="#FFFFFF" stroke="#E6B84D" strokeWidth="1" />
      </svg>
      <span className="qc-ayah-medallion-num">{number}</span>
    </span>
  );
}

/**
 * 2. Whisper-thin 1px Architectural Mosque Skyline SVG (Iqraa Header Line Art)
 */
export function MosqueSkylineSvg({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYBottom slice"
    >
      <g stroke="#186A4B" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" opacity="0.22">
        <line x1="0" y1="108" x2="400" y2="108" />
        {/* Left Minaret */}
        <rect x="44" y="42" width="12" height="66" />
        <rect x="41" y="37" width="18" height="5" />
        <path d="M44 37 C44 25 56 25 56 37" />
        <line x1="50" y1="18" x2="50" y2="27" />
        <circle cx="50" cy="16" r="1.5" />
        {/* Left Side Dome */}
        <path d="M68 108 L68 82 C68 64 106 64 106 82 L106 108" />
        <path d="M77 82 C77 70 97 70 97 82" />
        {/* Grand Central Dome */}
        <path d="M118 108 L118 74 L232 74 L232 108" />
        <path d="M132 74 C132 30 218 30 218 74" />
        <path d="M148 74 C148 44 202 44 202 74" strokeDasharray="2 3" />
        <line x1="175" y1="22" x2="175" y2="38" />
        <path d="M171 20 A 5 5 0 1 0 179 20 A 3.8 3.8 0 1 1 171 20 Z" />
        {/* Courtyard Arches */}
        <path d="M132 108 L132 89 C132 82 146 82 146 89 L146 108" />
        <path d="M156 108 L156 86 C156 78 194 78 194 86 L194 108" />
        <path d="M204 108 L204 89 C204 82 218 82 218 89 L218 108" />
        {/* Right Side Dome */}
        <path d="M244 108 L244 82 C244 64 282 64 282 82 L282 108" />
        {/* Tall Right Minaret */}
        <rect x="302" y="28" width="14" height="80" />
        <rect x="299" y="23" width="20" height="5" />
        <rect x="300" y="54" width="18" height="4" />
        <path d="M302 23 C302 9 316 9 316 23" />
        <line x1="309" y1="2" x2="309" y2="11" />
        {/* Far Right Arch */}
        <path d="M328 108 L328 90 C328 77 368 77 368 90 L368 108" />
      </g>
    </svg>
  );
}

/**
 * 3. 8-Fold Islamic Girih Geometric Corner Watermark (Al-Shamela Hero Card)
 */
export function GirihWatermarkSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke="currentColor" strokeWidth="1.25">
        <circle cx="100" cy="100" r="88" strokeDasharray="4 4" />
        <circle cx="100" cy="100" r="68" />
        <circle cx="100" cy="100" r="34" />
        <rect x="42" y="42" width="116" height="116" />
        <rect x="42" y="42" width="116" height="116" transform="rotate(45 100 100)" />
        <polygon points="100,10 122,78 190,100 122,122 100,190 78,122 10,100 78,78" />
        <polygon
          points="100,10 122,78 190,100 122,122 100,190 78,122 10,100 78,78"
          transform="rotate(22.5 100 100)"
        />
        <line x1="100" y1="0" x2="100" y2="200" opacity="0.5" />
        <line x1="0" y1="100" x2="200" y2="100" opacity="0.5" />
      </g>
    </svg>
  );
}

/**
 * 4. Curated Architectural Mosque Artwork for `PictureCard` (`VenueArt` upgrade)
 * Deterministic palette + silhouette based on venue seed
 */
export function VenueArchArtSvg({
  seed = 'masjid-1',
  height = 96,
}: {
  seed?: string;
  height?: number;
}) {
  const palettes = [
    { bg1: '#113A29', bg2: '#239B73', accent: '#FFB04D', dome: '#E1F5EC' },
    { bg1: '#164E38', bg2: '#2EAF82', accent: '#FCD34D', dome: '#F3FBF7' },
    { bg1: '#0F2E22', bg2: '#1D5C42', accent: '#F59E0B', dome: '#D1FAE5' },
    { bg1: '#1E3A34', bg2: '#2A7B62', accent: '#FBBF24', dome: '#ECFDF5' },
  ];
  const idx =
    seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % palettes.length;
  const p = palettes[idx]!;
  const gradId = `venue-grad-${seed.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox="0 0 220 110"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="220" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={p.bg1} />
          <stop offset="100%" stopColor={p.bg2} />
        </linearGradient>
      </defs>
      <rect width="220" height="110" fill={`url(#${gradId})`} />
      {/* Subtle geometric rosette in sky */}
      <circle cx="185" cy="26" r="32" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="185" cy="26" r="18" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1" />
      <circle cx="185" cy="26" r="5" fill={p.accent} fillOpacity="0.85" />
      {/* Architectural Mosque Silhouette */}
      <path
        d="M0 110 L0 84 L32 84 L32 42 L38 30 L44 42 L44 84 L62 84 C62 52 124 52 124 84 L144 84 C144 66 178 66 178 84 L220 84 L220 110 Z"
        fill="#0A2319"
        fillOpacity="0.45"
      />
      {/* Illuminated Arch Windows */}
      <path d="M82 110 L82 88 C82 81 92 81 92 88 L92 110 Z" fill={p.accent} fillOpacity="0.55" />
      <path d="M98 110 L98 88 C98 81 108 81 108 88 L108 110 Z" fill={p.accent} fillOpacity="0.55" />
      {/* Dome Finial */}
      <line x1="93" y1="49" x2="93" y2="59" stroke={p.dome} strokeOpacity="0.7" strokeWidth="1.4" />
    </svg>
  );
}
