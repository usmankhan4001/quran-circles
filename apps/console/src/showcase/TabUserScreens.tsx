import React, { useState } from 'react';
import {
  PhIcon,
  MosqueSkylineSvg,
  GirihWatermarkSvg,
  VenueArchArtSvg,
  AyahMedallion,
} from './icons';

export type UserScreenId =
  | 'home'
  | 'nearby'
  | 'session'
  | 'venue'
  | 'registration'
  | 'quran'
  | 'memorisation'
  | 'journey'
  | 'updates'
  | 'profile';

interface ScreenSpecMeta {
  id: UserScreenId;
  title: string;
  file: string;
  icon: string;
  summary: string;
  components: string[];
}

const USER_SCREENS: ScreenSpecMeta[] = [
  {
    id: 'home',
    title: '1. HomeScreen (Full 10-Section Feed)',
    file: 'apps/user-app/src/screens/HomeScreen.tsx',
    icon: 'house',
    summary:
      'Complete vertical architecture: Iqraa Mist HeroHeader + NextCircleCard anchor + Search/Filter row + 5-Waqt PrayerStrip + ReadAlongCard + Near You PictureCard carousel + Dora-e-Quran secondary card + Vector MapPreviewCard + AyahOfTheDayCard + DaysReadCard + CommunityTodayCard + 4 HomeShortcuts.',
    components: [
      'HeroHeader',
      'NextCircleCard',
      'SearchButton + Filter',
      'PrayerStrip',
      'ReadAlongCard',
      'PictureCard Carousel',
      'SessionCard (Secondary Program)',
      'MapPreviewCard',
      'AyahOfTheDayCard',
      'DaysReadCard',
      'CommunityTodayCard',
      'HomeShortcuts',
    ],
  },
  {
    id: 'nearby',
    title: '2. NearbyScreen (List / Map + Sheets)',
    file: 'apps/user-app/src/screens/NearbyScreen.tsx',
    icon: 'compass',
    summary:
      'Discovery engine with SearchField, City/Area/Day/Section filter chips, removable active chips, List vs Map SegmentedControl, horizontal Nearest PictureCards, vertical SessionCards, and interactive FiltersSheet drawer.',
    components: [
      'SearchField',
      'Chip (City/Area/Day/Section)',
      'SegmentedControl (List/Map)',
      'PictureCard (Nearest)',
      'SessionCard',
      'FiltersSheet',
      'AreaPickerSheet',
      'EmptyState',
    ],
  },
  {
    id: 'session',
    title: '3. SessionScreen (Circle Detail)',
    file: 'apps/user-app/src/screens/SessionScreen.tsx',
    icon: 'mosque',
    summary:
      'Masjid architectural header with Back/Share, section/program/language Tags, schedule & duration, Ustadh & Hybrid online link, SeatMeter capacity card, Upcoming Occurrences with Surah/Ayah portions, FacilitiesChecklist, and sticky RegisterFooter.',
    components: [
      'VenueArchArt Header',
      'Tag (Section/Program/Lang)',
      'ListItem (Venue & Ustadh)',
      'SeatMeter',
      'Occurrences Portion List',
      'FacilitiesChecklist',
      'RegisterFooter (4 States)',
    ],
  },
  {
    id: 'venue',
    title: '4. VenueScreen (Masjid Profile)',
    file: 'apps/user-app/src/screens/VenueScreen.tsx',
    icon: 'map-pin',
    summary:
      'Masjid profile page with architectural banner, Follow Masjid toggle (for daily Ayah & announcements), verified facilities checklist, interactive street map card with Directions CTA, and all weekly circles hosted at this Masjid.',
    components: [
      'VenueHeader',
      'Follow Toggle Button',
      'MapPreviewCard',
      'FacilitiesChecklist',
      'Hosted SessionCard List',
    ],
  },
  {
    id: 'registration',
    title: '5. RegistrationScreen (Seat + OTP)',
    file: 'apps/user-app/src/screens/RegistrationScreen.tsx',
    icon: 'ticket',
    summary:
      'Frictionless 3-step seat reservation: Stepper for seats (1–5), Phone TextField, 6-digit CodeField OTP verification, and Confirmed Seat Pass with QR & Calendar export.',
    components: ['Stepper', 'TextField (Phone)', 'CodeField (6-Cell OTP)', 'Confirmed Pass Card'],
  },
  {
    id: 'quran',
    title: '6. QuranPrayerScreen (Mushaf & Waqt)',
    file: 'apps/user-app/src/screens/QuranPrayerScreen.tsx',
    icon: 'book-open-text',
    summary:
      '4-mode worship hub: Continuous Mushaf page with ornate Surah banner, Rub el Hizb AyahMedallions, contextual verse action bar & dark-emerald ReciterBar audio pill; plus Surahs/Juz index, 5-Waqt Prayer schedule, and Qibla compass.',
    components: [
      'SegmentedControl (Mushaf/Surahs/Prayer/Qibla)',
      'SurahOrnamentalBanner',
      'AyahMedallion (StarNumber)',
      'ReciterBar Audio Pill',
      'Qibla Dial',
    ],
  },
  {
    id: 'memorisation',
    title: '7. MemorisationScreen (Hifz Tracker)',
    file: 'apps/user-app/src/screens/MemorisationScreen.tsx',
    icon: 'brain',
    summary:
      'Dedicated Hifz & revision companion: active Surah progress ring, ayah-by-ayah hide/reveal toggle for self-testing, audio loop range (e.g. Ayah 1–5 × 5x), and revision queue.',
    components: ['Hifz Progress Card', 'Ayah Hide/Reveal Toggle', 'Audio Loop Control', 'Revision List'],
  },
  {
    id: 'journey',
    title: '8. JourneyScreen (My Circles & History)',
    file: 'apps/user-app/src/screens/JourneyScreen.tsx',
    icon: 'bookmarks',
    summary:
      'Personal hub showing upcoming reserved seats with quick Directions/Cancel actions, Followed Masjids & Circles, and past attendance log.',
    components: ['Upcoming Seat Pass Card', 'Followed Masjids List', 'Past Attendance Timeline'],
  },
  {
    id: 'updates',
    title: '9. UpdatesScreen (Coordinator Feed)',
    file: 'apps/user-app/src/screens/UpdatesScreen.tsx',
    icon: 'bell-ringing',
    summary:
      'Chronological feed of announcements from followed Masjids and registered circles: tonight’s Surah portion, room changes, and Ramadan Dora-e-Quran schedules.',
    components: ['Update Feed Card', 'Unread Badge', 'Direct Portion Reader Link'],
  },
  {
    id: 'profile',
    title: '10. ProfileScreen (Goals, Lang & City)',
    file: 'apps/user-app/src/screens/ProfileScreen.tsx',
    icon: 'user-circle',
    summary:
      'User settings: Bilingual switcher (English / اردو Nastaliq), Daily Reading Goal (pages or minutes), Home City & Area preference, and notification controls.',
    components: ['Language SegmentedControl', 'Daily Goal Picker', 'City Selector', 'Switch Rows'],
  },
];

export function TabUserScreens({ rtl }: { rtl: boolean }) {
  const [activeScreen, setActiveScreen] = useState<UserScreenId>('home');
  const [nearbyView, setNearbyView] = useState<'list' | 'map'>('list');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [sessionFooterState, setSessionFooterState] = useState<'register' | 'waitlist' | 'registered'>('register');
  const [quranSubTab, setQuranSubTab] = useState<'mushaf' | 'surahs' | 'prayer' | 'qibla'>('mushaf');
  const [regStep, setRegStep] = useState<'form' | 'otp' | 'confirmed'>('form');
  const [hideAyahWords, setHideAyahWords] = useState(false);

  const currentMeta = USER_SCREENS.find((s) => s.id === activeScreen) ?? USER_SCREENS[0]!;

  return (
    <div>
      <div className="wb-section-header">
        <div>
          <div className="wb-eyebrow">Part 4 · User App — All 10 Screens Interactive Explorer</div>
          <h1 className="wb-h1">Screen-by-Screen Architecture & Interactive Mobile Simulator</h1>
          <p className="wb-desc">
            Select any of the 10 production User App screens on the left, interact with the live
            components and bottom sheets inside the phone frame, and inspect the exact component
            composition on the right.
          </p>
        </div>
      </div>

      <div className="explorer-layout">
        {/* LEFT COLUMN: 10-SCREEN SELECTOR */}
        <div className="screen-selector-list">
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', padding: '6px 10px', textTransform: 'uppercase' }}>
            All 10 User App Screens
          </div>
          {USER_SCREENS.map((scr) => {
            const active = scr.id === activeScreen;
            return (
              <button
                key={scr.id}
                type="button"
                className={`screen-selector-btn ${active ? 'active' : ''}`}
                onClick={() => {
                  setActiveScreen(scr.id);
                  setShowFilterSheet(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: active ? '#186A4B' : '#F1F5F9',
                      color: active ? '#FFFFFF' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PhIcon name={scr.icon} weight={active ? 'fill' : 'duotone'} size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: active ? '#103A2A' : '#111827' }}>
                      {scr.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748B' }}>
                      {scr.components.length} components
                    </div>
                  </div>
                </div>
                <PhIcon name="caret-right" weight="bold" size={14} color={active ? '#186A4B' : '#CBD5E1'} />
              </button>
            );
          })}
        </div>

        {/* CENTER COLUMN: INTERACTIVE PHONE DEVICE */}
        <div className="phone-device" dir={rtl ? 'rtl' : 'ltr'}>
          {/* Status Bar */}
          <div className="phone-status-bar">
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PhIcon name="cell-signal-full" weight="bold" size={13} />
              <PhIcon name="wifi-high" weight="bold" size={13} />
              <PhIcon name="battery-full" weight="fill" size={15} />
            </div>
          </div>

          {/* Scrollable Screen Viewport */}
          <div className="phone-scroll-body">
            {/* ==============================================================
                SCREEN 1: HOMESCREEN (ALL 10 REAL SECTIONS)
               ============================================================== */}
            {activeScreen === 'home' && (
              <div>
                {/* 1. HeroHeader with Mosque Skyline Mist + Hijri Date + City + Bell + Profile */}
                <div className="phone-mist-header">
                  <MosqueSkylineSvg className="phone-mist-skyline" />
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#186A4B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        14 Ramadan 1447 AH
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {rtl ? 'لاہور کے حلقے' : 'Lahore'}
                        <PhIcon name="caret-down" weight="bold" size={14} color="#186A4B" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="qc-icon-btn glass"
                        onClick={() => setActiveScreen('updates')}
                        title="Open UpdatesScreen"
                      >
                        <PhIcon name="bell-ringing" weight="duotone" size={19} color="#186A4B" />
                        <span className="qc-icon-btn-badge">2</span>
                      </button>
                      <button
                        type="button"
                        className="qc-icon-btn glass"
                        onClick={() => setActiveScreen('profile')}
                        title="Open ProfileScreen"
                      >
                        <PhIcon name="user-circle" weight="duotone" size={20} color="#111827" />
                      </button>
                    </div>
                  </div>

                  {/* 2. Lead NextCircleCard (Hero Card sitting on the mist header) */}
                  <div className="qc-hero-emerald" style={{ position: 'relative', zIndex: 2, padding: 16 }}>
                    <div className="qc-hero-girih">
                      <GirihWatermarkSvg />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#A7F3D0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <PhIcon name="check-circle" weight="fill" size={12} /> Your Next Circle
                      </span>
                      <span style={{ fontSize: 10.5, background: 'rgba(255,255,255,0.16)', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                        In 2h 15m
                      </span>
                    </div>
                    <div
                      onClick={() => setActiveScreen('session')}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800 }}>
                        Tafseer Surah Al-Kahf
                      </div>
                      <div style={{ fontSize: 11.5, color: '#D1FAE5', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <PhIcon name="map-pin" weight="fill" size={13} />
                        Jamia Masjid Al-Noor, Gulberg III
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>
                          7:30
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#A7F3D0' }}>PM</span>
                        <span style={{ fontSize: 11.5, color: '#D1FAE5' }}>· Today after Maghrib</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, margin: '10px 0 12px' }}>
                      <span style={{ background: '#FFF3E0', color: '#92400E', padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <PhIcon name="book-open-text" weight="fill" size={12} /> Al-Kahf 1–31
                      </span>
                      <span style={{ background: 'rgba(255,255,255,0.16)', color: '#FFF', padding: '3px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>
                        Brothers
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 8 }}>
                      <button
                        type="button"
                        className="qc-btn qc-btn-sm"
                        style={{ background: 'rgba(255,255,255,0.14)', color: '#FFF', border: '1px solid rgba(255,255,255,0.24)' }}
                        onClick={() => setActiveScreen('venue')}
                      >
                        <PhIcon name="path" weight="bold" size={14} /> Directions
                      </button>
                      <button
                        type="button"
                        className="qc-btn qc-btn-white-hero qc-btn-sm"
                        onClick={() => setActiveScreen('journey')}
                      >
                        <PhIcon name="ticket" weight="fill" size={14} /> My Registration
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Stack inside HomeScreen */}
                <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* 3. SearchButton + Filter Button Row */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setActiveScreen('nearby')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 14,
                        padding: '10px 12px',
                        fontSize: 12.5,
                        color: '#64748B',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-card)',
                      }}
                    >
                      <PhIcon name="magnifying-glass" weight="bold" size={16} color="#186A4B" />
                      <span>Search masjid, area, or surah…</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScreen('nearby');
                        setShowFilterSheet(true);
                      }}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        background: '#186A4B',
                        color: '#FFF',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <PhIcon name="sliders-horizontal" weight="bold" size={18} />
                    </button>
                  </div>

                  {/* 4. PrayerStrip (5 Daily Prayers) */}
                  <div className="qc-prayer-strip" onClick={() => { setActiveScreen('quran'); setQuranSubTab('prayer'); }} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#186A4B', marginBottom: 6 }}>
                      <span><PhIcon name="mosque" weight="duotone" size={13} /> Next: Maghrib in 24m</span>
                      <span style={{ color: '#64748B' }}>Lahore</span>
                    </div>
                    <div className="qc-prayer-row">
                      {[
                        { n: 'Fajr', t: '4:42', ic: 'sun-horizon', a: false },
                        { n: 'Dhuhr', t: '12:15', ic: 'sun', a: false },
                        { n: 'Asr', t: '4:35', ic: 'cloud-sun', a: false },
                        { n: 'Maghrib', t: '6:28', ic: 'sun-horizon', a: true },
                        { n: 'Isha', t: '7:55', ic: 'moon-stars', a: false },
                      ].map((p) => (
                        <div key={p.n} className={`qc-prayer-pill ${p.a ? 'active' : ''}`}>
                          <PhIcon name={p.ic} weight={p.a ? 'fill' : 'duotone'} size={15} color={p.a ? '#186A4B' : '#64748B'} />
                          <span style={{ fontSize: 10, fontWeight: p.a ? 800 : 600 }}>{p.n}</span>
                          <span style={{ fontSize: 9.5, color: p.a ? '#186A4B' : '#94A3B8' }}>{p.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 5. ReadAlongCard ("Read Tonight's Portion") */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      background: 'linear-gradient(135deg, #FFFDF9 0%, #FFF8EB 100%)',
                      border: '1px solid #FDE2B8',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>
                        Tonight&apos;s Circle Portion
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginTop: 2 }}>
                        Surah Al-Kahf · Ayahs 1–31
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Masjid Al-Noor · 7:30 PM
                      </div>
                    </div>
                    <button
                      type="button"
                      className="qc-btn qc-btn-primary qc-btn-sm"
                      onClick={() => {
                        setActiveScreen('quran');
                        setQuranSubTab('mushaf');
                      }}
                    >
                      <PhIcon name="book-open" weight="bold" size={13} /> Read
                    </button>
                  </div>

                  {/* 6. Near You Horizontal PictureCard Carousel */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800 }}>
                        Quran Circles Near You
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveScreen('nearby')}
                        style={{ border: 'none', background: 'none', color: '#186A4B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        See all 14 →
                      </button>
                    </div>
                    <div className="qc-picture-row">
                      {[
                        { seed: 'm1', title: 'Sisters Tajweed Circle', sub: 'Jamia Fatima · Sat 4:45 PM', dist: '1.2 km' },
                        { seed: 'm2', title: 'Youth Seerah & Quran', sub: 'DHA Phase 4 · Fri 8:15 PM', dist: '2.0 km' },
                        { seed: 'm3', title: 'Fajr Tadabbur Halqa', sub: 'Model Town Masjid · Daily', dist: '2.6 km' },
                      ].map((c) => (
                        <div
                          key={c.seed}
                          className="qc-picture-card"
                          style={{ width: 154 }}
                          onClick={() => setActiveScreen('session')}
                        >
                          <div className="qc-picture-art" style={{ height: 80 }}>
                            <VenueArchArtSvg seed={c.seed} height={80} />
                            <span className="qc-picture-dist">{c.dist}</span>
                          </div>
                          <div className="qc-picture-body">
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{c.title}</div>
                            <div style={{ fontSize: 10.5, color: '#64748B' }}>{c.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 7. Secondary Program Card (Dora-e-Quran Intensive) */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                      Also this season · Dora-e-Quran
                    </div>
                    <div className="qc-session-card" onClick={() => setActiveScreen('session')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span className="qc-badge qc-badge-amber" style={{ marginBottom: 6 }}>
                            <PhIcon name="moon-stars" weight="fill" size={12} /> Dora-e-Quran · Juz 15
                          </span>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111827' }}>
                            Complete Ramadan Tarawih Tafseer
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                            Jamia Ashrafia Hall · Tonight 9:00 PM
                          </div>
                        </div>
                        <span className="qc-btn qc-btn-secondary qc-btn-sm">Join →</span>
                      </div>
                    </div>
                  </div>

                  {/* 8. MapPreviewCard */}
                  <div className="qc-map-preview-card" style={{ height: 132 }} onClick={() => { setActiveScreen('nearby'); setNearbyView('map'); }}>
                    <svg width="100%" height="132" viewBox="0 0 380 132" preserveAspectRatio="xMidYMid slice">
                      <rect width="380" height="132" fill="#EBF5F0" />
                      <rect x="16" y="10" width="90" height="50" rx="10" fill="#D5EDE2" />
                      <path d="M 0 95 Q 140 65, 380 85" stroke="#BAE6FD" strokeWidth="12" fill="none" />
                      <g stroke="#FFFFFF" strokeWidth="5">
                        <line x1="0" y1="40" x2="380" y2="40" />
                        <line x1="120" y1="0" x2="100" y2="132" />
                        <line x1="250" y1="0" x2="265" y2="132" />
                      </g>
                      <circle cx="135" cy="38" r="8" fill="#186A4B" stroke="#FFF" strokeWidth="2" />
                      <circle cx="240" cy="52" r="9" fill="#103A2A" stroke="#FFF" strokeWidth="2" />
                    </svg>
                    <div className="qc-map-caption-bar" style={{ padding: '8px 12px' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>14 Circles on the Lahore Map</div>
                        <div style={{ fontSize: 10.5, color: '#64748B' }}>Tap to explore by neighbourhood</div>
                      </div>
                      <PhIcon name="arrow-up-right" weight="bold" size={16} color="#186A4B" />
                    </div>
                  </div>

                  {/* 9. AyahOfTheDayCard */}
                  <div className="qc-session-card" style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: '#186A4B', textTransform: 'uppercase' }}>
                        Ayah of the Day
                      </span>
                      <span style={{ fontSize: 10.5, color: '#64748B' }}>Surah Al-Kahf · 18:28</span>
                    </div>
                    <div className="qc-arabic-verse" style={{ fontSize: 19 }}>
                      وَٱصْبِرْ نَفْسَكَ مَعَ ٱلَّذِينَ يَدْعُونَ رَبَّهُم <AyahMedallion number={28} size={24} />
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                      &ldquo;And keep yourself patiently with those who call upon their Lord…&rdquo;
                    </div>
                  </div>

                  {/* 10. DaysReadCard + CommunityTodayCard + HomeShortcuts */}
                  <div className="qc-session-card" style={{ background: '#F3FBF7', borderColor: '#BFE8D6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#186A4B', textTransform: 'uppercase' }}>
                          Your Reading · 4 of 7 Days This Week
                        </div>
                        <div style={{ fontSize: 12, color: '#103A2A', marginTop: 2 }}>
                          1,420 people read 4,890 pages together today
                        </div>
                      </div>
                      <span className="qc-badge qc-badge-emerald">✓ Counted</span>
                    </div>
                  </div>

                  {/* 11. HomeShortcuts ("Also in the app") */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase' }}>
                      Also in the App
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {[
                        { label: 'Quran', icon: 'book-open-text', target: 'quran' as UserScreenId },
                        { label: 'Prayer', icon: 'mosque', target: 'quran' as UserScreenId },
                        { label: 'Hifz', icon: 'brain', target: 'memorisation' as UserScreenId },
                        { label: 'Updates', icon: 'bell-ringing', target: 'updates' as UserScreenId, badge: '2' },
                      ].map((sc) => (
                        <button
                          key={sc.label}
                          type="button"
                          onClick={() => setActiveScreen(sc.target)}
                          style={{
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            borderRadius: 14,
                            padding: '10px 4px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 5,
                            cursor: 'pointer',
                            position: 'relative',
                          }}
                        >
                          <PhIcon name={sc.icon} weight="duotone" size={20} color="#186A4B" />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{sc.label}</span>
                          {sc.badge && (
                            <span className="qc-icon-btn-badge" style={{ top: 4, right: 6 }}>
                              {sc.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==============================================================
                SCREEN 2: NEARBYSCREEN (LIST / MAP + FILTER SHEET)
               ============================================================== */}
            {activeScreen === 'nearby' && (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                    Nearby Circles
                  </div>
                  <div className="qc-segmented">
                    <button
                      type="button"
                      className={`qc-seg-btn ${nearbyView === 'list' ? 'active' : ''}`}
                      onClick={() => setNearbyView('list')}
                    >
                      <PhIcon name="list-bullets" weight="bold" size={14} /> List
                    </button>
                    <button
                      type="button"
                      className={`qc-seg-btn ${nearbyView === 'map' ? 'active' : ''}`}
                      onClick={() => setNearbyView('map')}
                    >
                      <PhIcon name="map-trifold" weight="duotone" size={14} /> Map
                    </button>
                  </div>
                </div>

                {/* SearchField */}
                <div className="qc-input-pill focused">
                  <PhIcon name="magnifying-glass" weight="bold" size={16} color="#186A4B" />
                  <input type="text" placeholder="Search masjid, ustadh, or surah…" />
                </div>

                {/* Horizontal Chip Filter Bar */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  <button type="button" className="qc-chip selected" onClick={() => setShowFilterSheet(true)}>
                    <PhIcon name="map-pin" weight="fill" size={13} /> Lahore · Gulberg
                  </button>
                  <button type="button" className="qc-chip" onClick={() => setShowFilterSheet(true)}>
                    Day: Any <PhIcon name="caret-down" weight="bold" size={11} />
                  </button>
                  <button type="button" className="qc-chip" onClick={() => setShowFilterSheet(true)}>
                    Brothers <PhIcon name="caret-down" weight="bold" size={11} />
                  </button>
                  <button type="button" className="qc-chip removable" onClick={() => setShowFilterSheet(true)}>
                    <PhIcon name="sliders-horizontal" weight="bold" size={13} /> Filters (2)
                  </button>
                </div>

                {nearbyView === 'list' ? (
                  <>
                    {/* Nearest PictureCard Row */}
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                      Closest to You
                    </div>
                    <div className="qc-picture-row">
                      {[
                        { seed: 'n1', title: 'Masjid Al-Noor', sub: 'Today 7:30 PM', dist: '0.8 km' },
                        { seed: 'n2', title: 'Jamia Fatima Hall', sub: 'Sat 4:45 PM', dist: '1.2 km' },
                      ].map((p) => (
                        <div key={p.seed} className="qc-picture-card" style={{ width: 162 }} onClick={() => setActiveScreen('session')}>
                          <div className="qc-picture-art" style={{ height: 76 }}>
                            <VenueArchArtSvg seed={p.seed} height={76} />
                            <span className="qc-picture-dist">{p.dist}</span>
                          </div>
                          <div className="qc-picture-body">
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{p.title}</div>
                            <div style={{ fontSize: 10.5, color: '#64748B' }}>{p.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Vertical SessionCards */}
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginTop: 4 }}>
                      All 14 Matching Circles
                    </div>
                    {[
                      {
                        title: 'Tafseer Surah Al-Kahf & Reflections',
                        venue: 'Jamia Masjid Al-Noor, Gulberg III',
                        when: 'Thu · 7:30 PM (After Maghrib)',
                        portion: 'Al-Kahf 1–31',
                        sec: 'Brothers',
                        seats: '18 / 40 seats',
                        dist: '0.8 km',
                      },
                      {
                        title: 'Sisters Tajweed & Juz Amma Tadabbur',
                        venue: 'Jamia Fatima Zahra Hall, Cavalry',
                        when: 'Sat · 4:45 PM (After Asr)',
                        portion: 'Surah Al-Mulk 1–30',
                        sec: 'Sisters',
                        seats: '27 / 30 · 3 left',
                        dist: '1.4 km',
                      },
                      {
                        title: 'Ramadan Dora-e-Quran — Juz 15',
                        venue: 'DHA Phase 4 Central Masjid',
                        when: 'Daily · 9:00 PM (After Isha)',
                        portion: 'Surah Al-Isra',
                        sec: 'Families',
                        seats: 'Open Hall',
                        dist: '2.1 km',
                      },
                    ].map((s) => (
                      <div key={s.title} className="qc-session-card" onClick={() => setActiveScreen('session')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span className="qc-badge qc-badge-emerald">{s.sec}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#186A4B' }}>{s.dist}</span>
                        </div>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111827' }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                          <PhIcon name="map-pin" weight="regular" size={13} /> {s.venue}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginTop: 6 }}>
                          <PhIcon name="clock" weight="regular" size={13} color="#186A4B" /> {s.when}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #EDF2F7' }}>
                          <span className="qc-badge qc-badge-amber">{s.portion}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#186A4B' }}>
                            {s.seats} →
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  /* Interactive Map View Mode */
                  <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #BFE8D6', position: 'relative', height: 500 }}>
                    <svg width="100%" height="500" viewBox="0 0 360 500" preserveAspectRatio="xMidYMid slice">
                      <rect width="360" height="500" fill="#EBF5F0" />
                      <rect x="20" y="30" width="120" height="90" rx="16" fill="#D5EDE2" />
                      <rect x="210" y="180" width="130" height="110" rx="16" fill="#D5EDE2" />
                      <path d="M 0 260 Q 180 210, 360 245" stroke="#BAE6FD" strokeWidth="20" fill="none" />
                      <g stroke="#FFFFFF" strokeWidth="7">
                        <line x1="0" y1="110" x2="360" y2="110" />
                        <line x1="0" y1="320" x2="360" y2="320" />
                        <line x1="110" y1="0" x2="90" y2="500" />
                        <line x1="240" y1="0" x2="260" y2="500" />
                      </g>
                      <g transform="translate(145, 110)">
                        <circle r="22" fill="#186A4B" fillOpacity="0.22" />
                        <circle r="12" fill="#103A2A" stroke="#FFF" strokeWidth="3" />
                        <circle r="4" fill="#FFB04D" />
                      </g>
                      <g transform="translate(245, 165)">
                        <circle r="10" fill="#239B73" stroke="#FFF" strokeWidth="2.5" />
                      </g>
                      <g transform="translate(95, 290)">
                        <circle r="10" fill="#239B73" stroke="#FFF" strokeWidth="2.5" />
                      </g>
                    </svg>
                    {/* Selected Map Pin Drawer Card */}
                    <div
                      className="qc-session-card"
                      style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}
                      onClick={() => setActiveScreen('session')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="qc-badge qc-badge-emerald">Selected Masjid · 0.8 km</span>
                        <span className="qc-badge qc-badge-amber">Al-Kahf 1–31</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 6 }}>
                        Tafseer Surah Al-Kahf
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Jamia Masjid Al-Noor · Today 7:30 PM
                      </div>
                      <button type="button" className="qc-btn qc-btn-primary qc-btn-sm" style={{ width: '100%', marginTop: 10 }}>
                        Open Circle Details →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==============================================================
                SCREEN 3: SESSIONSCREEN (CIRCLE DETAIL)
               ============================================================== */}
            {activeScreen === 'session' && (
              <div>
                <div style={{ position: 'relative', height: 156 }}>
                  <VenueArchArtSvg seed="masjid-noor" height={156} />
                  <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', justifyContent: 'space-between' }}>
                    <button type="button" className="qc-icon-btn glass" onClick={() => setActiveScreen('home')}>
                      <PhIcon name="arrow-left" weight="bold" size={18} />
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="qc-icon-btn glass">
                        <PhIcon name="bookmark-simple" weight="duotone" size={18} color="#186A4B" />
                      </button>
                      <button type="button" className="qc-icon-btn glass">
                        <PhIcon name="share-network" weight="bold" size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="qc-badge qc-badge-emerald">
                      <PhIcon name="user" weight="duotone" size={13} /> Brothers
                    </span>
                    <span className="qc-badge qc-badge-amber">Weekly Halqa</span>
                    <span className="qc-badge qc-badge-neutral">Urdu & English</span>
                    <span className="qc-badge qc-badge-info">45 mins</span>
                  </div>

                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#111827' }}>
                      Tafseer Surah Al-Kahf & Reflections
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
                      Verse-by-verse reflection on the four trials of Surah Al-Kahf with practical
                      lessons for daily life. Open Q&A after Isha.
                    </div>
                  </div>

                  {/* Clickable Venue Row */}
                  <div
                    className="qc-session-card"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}
                    onClick={() => setActiveScreen('venue')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="ph-catalog-icon-box" style={{ width: 38, height: 38 }}>
                        <PhIcon name="mosque" weight="duotone" size={20} color="#186A4B" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>Jamia Masjid Al-Noor</div>
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>Main Blvd, Gulberg III · 0.8 km</div>
                      </div>
                    </div>
                    <PhIcon name="caret-right" weight="bold" size={16} color="#94A3B8" />
                  </div>

                  {/* Ustadh & Hybrid Stream Card */}
                  <div className="qc-session-card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFF3E0', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
                          UA
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>Ustadh Ahmad Al-Azhari</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>Lead Teacher · Hybrid Stream Available</div>
                        </div>
                      </div>
                      <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
                        <PhIcon name="video-camera" weight="duotone" size={14} color="#186A4B" /> Online
                      </button>
                    </div>
                  </div>

                  {/* SeatMeter Registration Card */}
                  <div className="qc-session-card">
                    <div className="qc-seat-meter">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: '#186A4B' }}>22 seats remaining</span>
                        <span style={{ color: '#64748B' }}>18 / 40 reserved</span>
                      </div>
                      <div className="qc-seat-bar">
                        <div className="qc-seat-fill" style={{ width: '45%', background: '#239B73' }} />
                      </div>
                    </div>
                  </div>

                  {/* Upcoming Occurrences with Surah/Ayah Portions */}
                  <div className="qc-session-card">
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
                      Upcoming Schedule & Portions
                    </div>
                    {[
                      { date: 'Tonight, 18 Oct · 7:30 PM', portion: 'Surah Al-Kahf · Ayah 1–31' },
                      { date: 'Thu, 25 Oct · 7:30 PM', portion: 'Surah Al-Kahf · Ayah 32–59' },
                      { date: 'Thu, 1 Nov · 7:30 PM', portion: 'Surah Al-Kahf · Ayah 60–82' },
                    ].map((occ) => (
                      <div key={occ.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                        <span style={{ fontWeight: 600 }}>{occ.date}</span>
                        <span className="qc-badge qc-badge-amber">{occ.portion}</span>
                      </div>
                    ))}
                  </div>

                  {/* FacilitiesChecklist */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { ic: 'drop', l: 'Wudu' },
                      { ic: 'car-profile', l: 'Parking' },
                      { ic: 'wheelchair', l: 'Wheelchair' },
                      { ic: 'wind', l: 'A/C Hall' },
                    ].map((f) => (
                      <span key={f.l} className="qc-badge qc-badge-neutral">
                        <PhIcon name={f.ic} weight="duotone" size={13} color="#186A4B" /> {f.l}
                      </span>
                    ))}
                  </div>

                  {/* Sticky RegisterFooter Preview */}
                  <div style={{ padding: 12, borderRadius: 18, background: '#FFFFFF', border: '1.5px solid #186A4B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Tonight · 7:30 PM</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#186A4B' }}>
                        {sessionFooterState === 'registered'
                          ? '✓ Seat Reserved (#14)'
                          : sessionFooterState === 'waitlist'
                            ? 'Waitlist Open'
                            : 'Free Registration'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="qc-btn qc-btn-primary qc-btn-sm"
                      onClick={() => setActiveScreen('registration')}
                    >
                      {sessionFooterState === 'registered'
                        ? 'View in Journey'
                        : sessionFooterState === 'waitlist'
                          ? 'Join Waitlist'
                          : 'Reserve Seat →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==============================================================
                SCREEN 4: VENUESCREEN (MASJID PROFILE)
               ============================================================== */}
            {activeScreen === 'venue' && (
              <div>
                <VenueArchArtSvg seed="masjid-noor" height={140} />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="qc-badge qc-badge-emerald">Verified Masjid</span>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                        Jamia Masjid Al-Noor
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        Main Boulevard, Block D, Gulberg III, Lahore
                      </div>
                    </div>
                    <button type="button" className="qc-btn qc-btn-emerald qc-btn-sm">
                      <PhIcon name="bell-ringing" weight="fill" size={14} /> Following
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
                      <PhIcon name="path" weight="bold" size={15} /> Open in Maps
                    </button>
                    <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
                      <PhIcon name="phone-call" weight="bold" size={15} /> Call Caretaker
                    </button>
                  </div>

                  <div className="qc-session-card">
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
                      Masjid Facilities
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span className="qc-badge qc-badge-emerald"><PhIcon name="drop" weight="duotone" size={13} /> Wudu Area</span>
                      <span className="qc-badge qc-badge-emerald"><PhIcon name="car-profile" weight="duotone" size={13} /> 80-Car Parking</span>
                      <span className="qc-badge qc-badge-emerald"><PhIcon name="door-open" weight="duotone" size={13} /> Sisters Gate #2</span>
                      <span className="qc-badge qc-badge-emerald"><PhIcon name="wheelchair" weight="duotone" size={13} /> Ramp Access</span>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>
                    3 Circles Hosted at Masjid Al-Noor
                  </div>
                  {[
                    { t: 'Tafseer Surah Al-Kahf', w: 'Thu · After Maghrib (7:30 PM)', s: 'Brothers' },
                    { t: 'Sisters Morning Tadabbur', w: 'Sat · 10:00 AM', s: 'Sisters' },
                    { t: 'After-Fajr Daily Tilawah', w: 'Daily · After Fajr (5:10 AM)', s: 'Mixed' },
                  ].map((c) => (
                    <div key={c.t} className="qc-session-card" onClick={() => setActiveScreen('session')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 800, fontSize: 13.5 }}>{c.t}</span>
                        <span className="qc-badge qc-badge-emerald">{c.s}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4 }}>{c.w}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                SCREEN 5: REGISTRATIONSCREEN (SEAT STEPPER + OTP + PASS)
               ============================================================== */}
            {activeScreen === 'registration' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="qc-icon-btn" style={{ width: 34, height: 34 }} onClick={() => setActiveScreen('session')}>
                    <PhIcon name="arrow-left" weight="bold" size={16} />
                  </button>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800 }}>
                    Reserve Your Seat
                  </div>
                </div>

                {/* Step Switcher for Demo */}
                <div className="qc-segmented" style={{ alignSelf: ' flex-start' }}>
                  <button type="button" className={`qc-seg-btn ${regStep === 'form' ? 'active' : ''}`} onClick={() => setRegStep('form')}>
                    1. Seats & Phone
                  </button>
                  <button type="button" className={`qc-seg-btn ${regStep === 'otp' ? 'active' : ''}`} onClick={() => setRegStep('otp')}>
                    2. OTP CodeField
                  </button>
                  <button type="button" className={`qc-seg-btn ${regStep === 'confirmed' ? 'active' : ''}`} onClick={() => setRegStep('confirmed')}>
                    3. Seat Pass
                  </button>
                </div>

                {regStep === 'form' && (
                  <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#186A4B' }}>TONIGHT · 7:30 PM</div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>Tafseer Surah Al-Kahf · Masjid Al-Noor</div>
                    </div>
                    <div>
                      <div className="qc-field-label" style={{ marginBottom: 6 }}>How many seats?</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 14, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Brothers Hall Seats</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="qc-icon-btn" style={{ width: 28, height: 28 }}>-</span>
                          <span style={{ fontWeight: 800 }}>2</span>
                          <span className="qc-icon-btn" style={{ width: 28, height: 28, background: '#186A4B', color: '#FFF' }}>+</span>
                        </div>
                      </div>
                    </div>
                    <div className="qc-field-group">
                      <label className="qc-field-label">Mobile Number (for SMS Pass)</label>
                      <div className="qc-input-pill focused">
                        <PhIcon name="phone" weight="duotone" size={18} color="#186A4B" />
                        <input type="text" defaultValue="+92 300 419 8821" />
                      </div>
                    </div>
                    <button type="button" className="qc-btn qc-btn-primary" onClick={() => setRegStep('otp')}>
                      Send 6-Digit Verification Code →
                    </button>
                  </div>
                )}

                {regStep === 'otp' && (
                  <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Enter 6-Digit SMS Code</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      Sent to +92 300 419 8821 · Auto-fills on arrival
                    </div>
                    <div className="qc-otp-row" style={{ justifyContent: 'center' }}>
                      {['4', '8', '2', '9', '1', '6'].map((d, i) => (
                        <div key={i} className="qc-otp-cell filled" style={{ width: 42, height: 48 }}>
                          {d}
                        </div>
                      ))}
                    </div>
                    <button type="button" className="qc-btn qc-btn-emerald" onClick={() => setRegStep('confirmed')}>
                      <PhIcon name="check-circle" weight="fill" size={16} /> Confirm Reservation
                    </button>
                  </div>
                )}

                {regStep === 'confirmed' && (
                  <div className="qc-hero-emerald" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <PhIcon name="check-circle" weight="fill" size={42} color="#34D399" />
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                      2 Seats Confirmed!
                    </div>
                    <div style={{ fontSize: 12, color: '#D1FAE5' }}>
                      Jamia Masjid Al-Noor · Tonight 7:30 PM (After Maghrib)
                    </div>
                    <div style={{ background: '#FFFFFF', color: '#111827', padding: 14, borderRadius: 16, width: '100%', marginTop: 4 }}>
                      <PhIcon name="qr-code" weight="regular" size={64} color="#103A2A" />
                      <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4 }}>PASS #QC-8841 · 2 BROTHERS</div>
                    </div>
                    <button type="button" className="qc-btn qc-btn-white-hero qc-btn-sm" style={{ width: '100%' }}>
                      <PhIcon name="calendar-plus" weight="bold" size={15} /> Add to Calendar
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ==============================================================
                SCREEN 6: QURANPRAYERSCREEN (MUSHAF / SURAHS / PRAYER / QIBLA)
               ============================================================== */}
            {activeScreen === 'quran' && (
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="qc-segmented" style={{ width: '100%', justifyContent: 'space-between' }}>
                  {(['mushaf', 'surahs', 'prayer', 'qibla'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`qc-seg-btn ${quranSubTab === tab ? 'active' : ''}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setQuranSubTab(tab)}
                    >
                      {tab === 'mushaf'
                        ? 'Mushaf'
                        : tab === 'surahs'
                          ? 'Surahs'
                          : tab === 'prayer'
                            ? 'Prayer'
                            : 'Qibla'}
                    </button>
                  ))}
                </div>

                {quranSubTab === 'mushaf' && (
                  <div
                    style={{
                      background: '#FFFDF9',
                      borderRadius: 20,
                      border: '1px solid #FDE2B8',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {/* Ornate Surah Banner */}
                    <div
                      style={{
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #186A4B 0%, #103A2A 100%)',
                        color: '#FFF',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#A7F3D0', fontWeight: 700 }}>Juz 15 · Makki</span>
                      <span style={{ fontFamily: 'var(--font-quran)', fontSize: 20 }}>سُورَةُ الكَهْفِ</span>
                      <span style={{ fontSize: 11, color: '#A7F3D0', fontWeight: 700 }}>110 Ayahs</span>
                    </div>

                    <div style={{ textAlign: 'center', fontFamily: 'var(--font-quran)', fontSize: 19, color: '#103A2A' }}>
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </div>

                    {/* Continuous Flowing Uthmani Mushaf Page */}
                    <div className="qc-arabic-verse" style={{ fontSize: 21, lineHeight: 2.15 }}>
                      ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ عَلَىٰ عَبْدِهِ ٱلْكِتَـٰبَ وَلَمْ يَجْعَل
                      لَّهُۥ عِوَجَا ۜ <AyahMedallion number={1} size={26} /> قَيِّمًا لِّيُنذِرَ
                      بَأْسًا شَدِيدًا مِّن لَّدُنْهُ وَيُبَشِّرَ ٱلْمُؤْمِنِينَ ٱلَّذِينَ
                      يَعْمَلُونَ ٱلصَّـٰلِحَـٰتِ أَنَّ لَهُمْ أَجْرًا حَسَنًا{' '}
                      <AyahMedallion number={2} size={26} />
                    </div>

                    {/* Active Verse Translation Card */}
                    <div style={{ padding: 10, borderRadius: 12, background: '#F3FBF7', border: '1px solid #BFE8D6', fontSize: 12, color: '#103A2A' }}>
                      <strong>18:1–2 (Tonight&apos;s Circle Portion):</strong> &ldquo;[All] praise is
                      [due] to Allah, who has sent down upon His Servant the Book and has not made
                      therein any deviance…&rdquo;
                    </div>

                    {/* Dark-Emerald Floating Reciter Audio Pill (Qurani Reference) */}
                    <div
                      style={{
                        background: '#103A2A',
                        color: '#FFFFFF',
                        borderRadius: 999,
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: '50%',
                            background: '#239B73',
                            color: '#FFF',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PhIcon name="play" weight="fill" size={14} />
                        </button>
                        <div>
                          <div style={{ fontSize: 11.5, fontWeight: 700 }}>Mishary Rashid Alafasy</div>
                          <div style={{ fontSize: 10, color: '#A7F3D0' }}>Surah Al-Kahf · Ayah 2 · 1.0x</div>
                        </div>
                      </div>
                      <PhIcon name="waveform" weight="duotone" size={20} color="#FFB04D" />
                    </div>
                  </div>
                )}

                {quranSubTab === 'surahs' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { num: 1, en: 'Al-Fatihah', ar: 'الفاتحة', ayahs: '7 Ayahs · Makki' },
                      { num: 18, en: 'Al-Kahf (Tonight’s Circle)', ar: 'الكهف', ayahs: '110 Ayahs · Makki' },
                      { num: 36, en: 'Ya-Sin', ar: 'يس', ayahs: '83 Ayahs · Makki' },
                      { num: 67, en: 'Al-Mulk', ar: 'الملك', ayahs: '30 Ayahs · Makki' },
                    ].map((s) => (
                      <div key={s.num} className="qc-session-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }} onClick={() => setQuranSubTab('mushaf')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <AyahMedallion number={s.num} size={32} />
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 800 }}>{s.en}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{s.ayahs}</div>
                          </div>
                        </div>
                        <span style={{ fontFamily: 'var(--font-quran)', fontSize: 20, color: '#186A4B' }}>{s.ar}</span>
                      </div>
                    ))}
                  </div>
                )}

                {quranSubTab === 'prayer' && (
                  <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>Lahore Prayer Schedule · 14 Ramadan</div>
                    {[
                      { n: 'Fajr', adhan: '4:42 AM', iqamah: '5:05 AM', ic: 'sun-horizon' },
                      { n: 'Dhuhr', adhan: '12:15 PM', iqamah: '1:30 PM', ic: 'sun' },
                      { n: 'Asr', adhan: '4:35 PM', iqamah: '5:00 PM', ic: 'cloud-sun' },
                      { n: 'Maghrib (Next)', adhan: '6:28 PM', iqamah: '6:31 PM', ic: 'sun-horizon', active: true },
                      { n: 'Isha & Tarawih', adhan: '7:55 PM', iqamah: '8:15 PM', ic: 'moon-stars' },
                    ].map((w) => (
                      <div
                        key={w.n}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: w.active ? '#F3FBF7' : '#F8FAFC',
                          border: w.active ? '1px solid #239B73' : '1px solid #EDF2F7',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <PhIcon name={w.ic} weight="duotone" size={18} color="#186A4B" />
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{w.n}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#186A4B' }}>
                          {w.adhan} · Iqamah {w.iqamah}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {quranSubTab === 'qibla' && (
                  <div className="qc-session-card" style={{ textAlign: 'center', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 150, height: 150, borderRadius: '50%', border: '6px solid #E1F5EC', background: '#F3FBF7', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <PhIcon name="compass" weight="duotone" size={88} color="#186A4B" />
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                      260.4° West-Southwest
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      3,592 km to Al-Masjid Al-Haram, Makkah
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==============================================================
                SCREEN 7: MEMORISATIONSCREEN (HIFZ TRACKER)
               ============================================================== */}
            {activeScreen === 'memorisation' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                  Hifz & Revision Companion
                </div>
                <div className="qc-hero-emerald" style={{ padding: 16 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#A7F3D0', textTransform: 'uppercase' }}>
                    Current Goal · Surah Al-Mulk (67)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                    22 of 30 Ayahs Memorised (73%)
                  </div>
                  <div className="qc-seat-bar" style={{ background: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
                    <div className="qc-seat-fill" style={{ width: '73%', background: '#FFB04D' }} />
                  </div>
                </div>

                <div className="qc-session-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#186A4B' }}>
                      Self-Test Mode · Ayah 23
                    </span>
                    <button
                      type="button"
                      className="qc-btn qc-btn-secondary qc-btn-sm"
                      onClick={() => setHideAyahWords(!hideAyahWords)}
                    >
                      <PhIcon name={hideAyahWords ? 'eye' : 'eye-slash'} weight="bold" size={14} />
                      {hideAyahWords ? 'Reveal Words' : 'Hide Middle Words'}
                    </button>
                  </div>
                  <div className="qc-arabic-verse" style={{ filter: hideAyahWords ? 'blur(4px)' : 'none', transition: 'filter 0.2s' }}>
                    قُلْ هُوَ ٱلَّذِىٓ أَنشَأَكُمْ وَجَعَلَ لَكُمُ ٱلسَّمْعَ وَٱلْأَبْصَـٰرَ
                    وَٱلْأَفْـِٔدَةَ <AyahMedallion number={23} size={26} />
                  </div>
                </div>
              </div>
            )}

            {/* ==============================================================
                SCREEN 8: JOURNEYSCREEN (MY CIRCLES & BOOKMARKS)
               ============================================================== */}
            {activeScreen === 'journey' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                  My Journey
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                  Upcoming Reserved Seats (1)
                </div>
                <div className="qc-session-card" style={{ borderColor: '#239B73' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="qc-badge qc-badge-emerald">Pass #QC-8841 · 2 Seats</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#186A4B' }}>Tonight 7:30 PM</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 6 }}>
                    Tafseer Surah Al-Kahf
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Jamia Masjid Al-Noor, Gulberg III</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm" onClick={() => setActiveScreen('venue')}>
                      Directions
                    </button>
                    <button type="button" className="qc-btn qc-btn-danger qc-btn-sm">
                      Release Seat
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginTop: 4 }}>
                  Followed Masjids & Circles (2)
                </div>
                <div className="qc-session-card">
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>Jamia Masjid Al-Noor</div>
                  <div style={{ fontSize: 11.5, color: '#64748B' }}>Receives Daily Ayah & room updates</div>
                </div>
              </div>
            )}

            {/* ==============================================================
                SCREEN 9: UPDATESSCREEN (COORDINATOR FEED)
               ============================================================== */}
            {activeScreen === 'updates' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                  Circle Updates
                </div>
                {[
                  {
                    masjid: 'Jamia Masjid Al-Noor',
                    time: '35m ago',
                    title: 'Tonight’s Portion Set: Surah Al-Kahf 1–31',
                    body: 'Ustadh Ahmad has shared the verses for tonight’s 7:30 PM circle. Tap below to read along before Maghrib.',
                    unread: true,
                  },
                  {
                    masjid: 'DHA Phase 4 Central Masjid',
                    time: 'Yesterday',
                    title: 'Dora-e-Quran Parking & Sisters Entrance Note',
                    body: 'Gate #2 on Street 14 is open 20 minutes before Isha with dedicated security volunteers.',
                    unread: false,
                  },
                ].map((u) => (
                  <div key={u.title} className="qc-session-card" style={{ borderLeft: u.unread ? '4px solid #186A4B' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
                      <span style={{ fontWeight: 700, color: '#186A4B' }}>{u.masjid}</span>
                      <span>{u.time}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{u.title}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>{u.body}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ==============================================================
                SCREEN 10: PROFILESCREEN (SETTINGS & GOALS)
               ============================================================== */}
            {activeScreen === 'profile' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                  Profile & Preferences
                </div>
                <div className="qc-session-card">
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>Usman Khan</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>+92 300 419 8821 · Lahore, Pakistan</div>
                </div>
                <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#186A4B' }}>Daily Quran Goal</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="qc-chip">2 Pages / day</span>
                    <span className="qc-chip selected">4 Pages / day</span>
                    <span className="qc-chip">15 Mins / day</span>
                  </div>
                </div>
                <div className="qc-session-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>App Language</span>
                  <span className="qc-badge qc-badge-emerald">English / اردو</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive FiltersSheet Overlay inside Phone */}
          {showFilterSheet && (
            <div className="phone-sheet-backdrop" onClick={() => setShowFilterSheet(false)}>
              <div className="phone-sheet-panel" onClick={(e) => e.stopPropagation()}>
                <div className="phone-sheet-handle" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>
                    Filter Quran Circles
                  </span>
                  <button type="button" className="qc-btn qc-btn-ghost qc-btn-sm" onClick={() => setShowFilterSheet(false)}>
                    Done
                  </button>
                </div>
                <div className="spec-sublabel" style={{ marginBottom: 6 }}>Prayer Time Band</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <span className="qc-chip">After Fajr</span>
                  <span className="qc-chip">After Asr</span>
                  <span className="qc-chip selected">After Maghrib</span>
                  <span className="qc-chip">After Isha</span>
                </div>
                <div className="spec-sublabel" style={{ marginBottom: 6 }}>Section</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  <span className="qc-chip selected">Brothers</span>
                  <span className="qc-chip">Sisters</span>
                  <span className="qc-chip">Families</span>
                </div>
                <button type="button" className="qc-btn qc-btn-primary" style={{ width: '100%' }} onClick={() => setShowFilterSheet(false)}>
                  Apply Filters (14 Circles)
                </button>
              </div>
            </div>
          )}

          {/* Floating Glass Pill Bottom Navigation Bar */}
          <div className="phone-floating-dock">
            {[
              { id: 'home' as UserScreenId, label: 'Home', icon: 'house' },
              { id: 'nearby' as UserScreenId, label: 'Nearby', icon: 'compass' },
              { id: 'quran' as UserScreenId, label: 'Quran', icon: 'book-open-text' },
              { id: 'journey' as UserScreenId, label: 'Journey', icon: 'bookmarks' },
            ].map((t) => {
              const active = activeScreen === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`phone-tab-btn ${active ? 'active' : ''}`}
                  onClick={() => setActiveScreen(t.id)}
                >
                  <PhIcon name={t.icon} weight={active ? 'fill' : 'duotone'} size={20} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: SELECTED SCREEN ARCHITECTURE & STATE CONTROLS */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name={currentMeta.icon} weight="duotone" size={22} color="#186A4B" />
              {currentMeta.title}
            </h3>
            <span className="spec-code-tag">{currentMeta.file}</span>
          </div>

          <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: 0 }}>
            {currentMeta.summary}
          </p>

          <div>
            <div className="spec-sublabel" style={{ marginBottom: 8 }}>
              Mounted Components in This Screen ({currentMeta.components.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {currentMeta.components.map((comp) => (
                <span key={comp} className="qc-badge qc-badge-emerald">
                  <PhIcon name="cube" weight="duotone" size={13} /> {comp}
                </span>
              ))}
            </div>
          </div>

          {/* Contextual Interactive State Controls for Current Screen */}
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>
              <PhIcon name="sliders" weight="duotone" size={16} color="#186A4B" /> Interactive State
              Triggers for Current Screen
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeScreen === 'nearby' && (
                <>
                  <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm" onClick={() => setNearbyView(nearbyView === 'list' ? 'map' : 'list')}>
                    Toggle List / Map View
                  </button>
                  <button type="button" className="qc-btn qc-btn-primary qc-btn-sm" onClick={() => setShowFilterSheet(!showFilterSheet)}>
                    Toggle FiltersSheet Drawer
                  </button>
                </>
              )}
              {activeScreen === 'session' && (
                <>
                  {(['register', 'waitlist', 'registered'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`qc-btn ${sessionFooterState === st ? 'qc-btn-primary' : 'qc-btn-secondary'} qc-btn-sm`}
                      onClick={() => setSessionFooterState(st)}
                    >
                      Footer: {st}
                    </button>
                  ))}
                </>
              )}
              {activeScreen !== 'nearby' && activeScreen !== 'session' && (
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Click any card, tab, or button inside the phone simulator to navigate between screens
                  and states.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
