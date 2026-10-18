import React, { useState } from 'react';
import './showcase.css';
import { PhIcon } from './icons';
import { ArtboardsHome } from './ArtboardsHome';
import { ArtboardsNearby } from './ArtboardsNearby';
import { ArtboardsSession } from './ArtboardsSession';
import { ArtboardsQuran } from './ArtboardsQuran';
import { ArtboardsAdmin } from './ArtboardsAdmin';
import { ArtboardsAdminManage } from './ArtboardsAdminManage';
import { ArtboardsConsole } from './ArtboardsConsole';
import { ArtboardsComponents } from './ArtboardsComponents';

export type FigmaPageId =
  | 'home'
  | 'nearby'
  | 'session'
  | 'quran'
  | 'admin'
  | 'admin-manage'
  | 'console'
  | 'styleguide';

interface FigmaPageMeta {
  id: FigmaPageId;
  appGroup: 'user-app' | 'admin-app' | 'console' | 'design-system';
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  layers: string[];
}

const FIGMA_PAGES: FigmaPageMeta[] = [
  {
    id: 'home',
    appGroup: 'user-app',
    title: '01. Home Flow (Circle-First)',
    subtitle:
      'Your Next Circle hero sitting half on the emerald header + Search/Filter + 5-Waqt PrayerStrip + Near You Mosque Cards + Read Tonight’s Portion + Map Preview + Ayah of the Day + Days Read + Area Picker Sheet.',
    badge: '@qc/user-app · 375 × 812',
    icon: 'house',
    layers: [
      '01. Home — Next Circle & Nearby',
      '02. Home — Below Fold (Portion, Map, Ayah)',
      '03. Home — City & Area Picker Sheet',
    ],
  },
  {
    id: 'nearby',
    appGroup: 'user-app',
    title: '02. Nearby & Circle Discovery',
    subtitle:
      'Find local Halqas and Ramadan Dora-e-Quran sessions by neighbourhood, prayer time band (After Fajr / Asr / Maghrib / Isha), section (Brothers / Sisters / Families), and interactive street map.',
    badge: '@qc/user-app · 375 × 812',
    icon: 'compass',
    layers: [
      '01. Nearby — List View & Filter Chips',
      '02. Nearby — Map View & Selected Masjid',
      '03. Nearby — Filters Bottom Sheet',
    ],
  },
  {
    id: 'session',
    appGroup: 'user-app',
    title: '03. Session, Registration & Journey',
    subtitle:
      'Masjid circle detail with SeatMeter capacity, upcoming Surah/Ayah portions, facilities, frictionless Seat Stepper + 6-digit SMS OTP registration, and My Journey confirmed pass.',
    badge: '@qc/user-app · 375 × 812',
    icon: 'ticket',
    layers: [
      '01. SessionScreen — Circle Detail & Portions',
      '02. RegistrationScreen — Seats & OTP',
      '03. JourneyScreen — Seat Pass & Follows',
    ],
  },
  {
    id: 'quran',
    appGroup: 'user-app',
    title: '04. Quran, Portion Reader & Hifz',
    subtitle:
      'Quran Index with Tonight’s Circle Portion hero + Hifz 2-up revision cards + Surah/Juz/Saved index, Illuminated Bismillah Portion Reader with audio reciter pill, Urdu Nastaliq & Reader Settings sheet, and Prayer/Circle schedule.',
    badge: '@qc/user-app · 375 × 812',
    icon: 'book-open-text',
    layers: [
      '01. QuranIndexScreen — Portion, Hifz & Surahs',
      '02. QuranReaderScreen — Portion & Audio',
      '03. Reader Settings, Urdu & Jump Sheet',
      '04. Prayer & Post-Prayer Circle Schedule',
    ],
  },
  {
    id: 'admin',
    appGroup: 'admin-app',
    title: '05. Coordinator — Today & Attendance',
    subtitle:
      'Masjid Coordinator Field App (@qc/admin-app): Scoped Masjid switcher, Tonight’s Live Halqa hub, 1-handed Attendance Headcount Stepper + Pass Check-In, Registrant Roster with 1-tap WhatsApp/Call, and Daily Ayah Picker.',
    badge: '@qc/admin-app · 375 × 812',
    icon: 'clipboard-text',
    layers: [
      '01. TodayScreen — Masjid Scope & Live Halqa',
      '02. AttendanceScreen — Stepper & Pass Check-In',
      '03. RegistrantsScreen — Roster & WhatsApp',
      '04. DailyAyahScreen — Masjid Ayah Picker',
    ],
  },
  {
    id: 'admin-manage',
    appGroup: 'admin-app',
    title: '06. Coordinator — Schedule, Updates & QR',
    subtitle:
      'Masjid Coordinator Field App (@qc/admin-app): Weekly Schedule & Occurrence Portion Editor, Follower Broadcast Composer with Templates & Recipient Preview, Printable A4 / WhatsApp QR Standee Generator, and Venue Editor.',
    badge: '@qc/admin-app · 375 × 812',
    icon: 'megaphone',
    layers: [
      '01. ScheduleScreen & Occurrence Portion Editor',
      '02. PostUpdateScreen — Broadcast & Templates',
      '03. PostersScreen — Printable A4 & WhatsApp QR',
      '04. VenueEditorScreen & Coordinator Account',
    ],
  },
  {
    id: 'console',
    appGroup: 'console',
    title: '07. Web Console — Operations & Admin',
    subtitle:
      'Desktop Operations Console (@qc/console): City-wide Venues & Circle Sessions management with live inspector drawer, Coordinator working-scope assignments, Daily Ayah curation, CSV Bulk Import validator, Batch QR Posters, and Immutable Audit Log.',
    badge: '@qc/console · 1140 × 720 Desktop',
    icon: 'desktop',
    layers: [
      '01. Console — Venues & Circle Sessions Management',
      '02. Console — Coordinators, Registrations & Daily Ayah',
      '03. Console — CSV Bulk Import, Batch QR & Audit Log',
    ],
  },
  {
    id: 'styleguide',
    appGroup: 'design-system',
    title: '08. Style Guide & @qc/ui Kit',
    subtitle:
      'Clean white Figma style-guide sheets covering Primary Emerald & Portion Amber ramps, Tri-Script Typography (Latin, Uthmani, Nastaliq), pill buttons, inputs, SeatMeter, and Phosphor Icons.',
    badge: '@qc/ui · Global Style Guide',
    icon: 'palette',
    layers: [
      'Style Guide 01 — Colors & Typography',
      'Style Guide 02 — @qc/ui & Phosphor Icons',
    ],
  },
];

export function ShowcaseApp() {
  const getInitialPage = (): FigmaPageId => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as FigmaPageId;
      if (FIGMA_PAGES.some((p) => p.id === hash)) return hash;
    }
    return 'home';
  };

  const [activePage, setActivePage] = useState<FigmaPageId>(getInitialPage);
  const currentMeta = FIGMA_PAGES.find((p) => p.id === activePage) ?? FIGMA_PAGES[0]!;

  React.useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as FigmaPageId;
      if (FIGMA_PAGES.some((p) => p.id === hash)) {
        setActivePage(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleNavigate = (page: string) => {
    const match = FIGMA_PAGES.find((p) => p.id === page);
    if (match) {
      window.location.hash = match.id;
      setActivePage(match.id);
    }
  };

  const renderGroup = (
    group: FigmaPageMeta['appGroup'],
    label: string,
  ) => {
    const pages = FIGMA_PAGES.filter((p) => p.appGroup === group);
    return (
      <div key={group}>
        <div className="figma-nav-group-label">{label}</div>
        {pages.map((pg) => (
          <button
            key={pg.id}
            type="button"
            className={`figma-nav-btn ${activePage === pg.id ? 'active' : ''}`}
            onClick={() => {
              window.location.hash = pg.id;
              setActivePage(pg.id);
            }}
          >
            <PhIcon name={pg.icon} weight="duotone" size={16} />
            <span>{pg.title}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="figma-workspace">
      {/* LEFT FIGMA SIDEBAR */}
      <aside className="figma-sidebar">
        <div>
          <div className="figma-project-title">
            <span>Quran Circles — UI Kit</span>
            <PhIcon name="caret-down" weight="bold" size={13} color="#94A3B8" />
          </div>
          <div className="figma-project-sub">All 3 Apps + @qc/ui · Phosphor Icons</div>
        </div>

        {renderGroup('user-app', '1. Seeker App (@qc/user-app)')}
        {renderGroup('admin-app', '2. Coordinator App (@qc/admin-app)')}
        {renderGroup('console', '3. Operations Web (@qc/console)')}
        {renderGroup('design-system', '4. Foundations (@qc/ui)')}

        <div>
          <div className="figma-nav-group-label">Artboards in Page</div>
          <div className="figma-layer-tree">
            {currentMeta.layers.map((layer, idx) => (
              <div
                key={layer}
                className={`figma-layer-item ${idx === 0 ? 'highlight' : ''}`}
              >
                <PhIcon name="hash" weight="bold" size={13} />
                <span>{layer}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN DARK ARTBOARD STAGE */}
      <main className="figma-stage">
        <div className="figma-stage-banner">
          <div>
            <h1>{currentMeta.title}</h1>
            <p>{currentMeta.subtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#1E563B',
                background: '#E8F5EE',
                padding: '6px 12px',
                borderRadius: 999,
              }}
            >
              {currentMeta.badge}
            </span>
          </div>
        </div>

        {activePage === 'home' && (
          <ArtboardsHome filter="all" onNavigatePage={handleNavigate} />
        )}
        {activePage === 'nearby' && (
          <ArtboardsNearby onNavigatePage={handleNavigate} />
        )}
        {activePage === 'session' && (
          <ArtboardsSession onNavigatePage={handleNavigate} />
        )}
        {activePage === 'quran' && (
          <ArtboardsQuran onNavigatePage={handleNavigate} />
        )}
        {activePage === 'admin' && (
          <ArtboardsAdmin onNavigatePage={handleNavigate} />
        )}
        {activePage === 'admin-manage' && (
          <ArtboardsAdminManage onNavigatePage={handleNavigate} />
        )}
        {activePage === 'console' && <ArtboardsConsole />}
        {activePage === 'styleguide' && <ArtboardsComponents />}
      </main>
    </div>
  );
}
