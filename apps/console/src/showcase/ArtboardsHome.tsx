import React, { useState } from 'react';
import { PhIcon, AyahMedallion } from './icons';

export function ArtboardsHome({
  filter,
  onNavigatePage,
}: {
  filter: string;
  onNavigatePage: (page: string) => void;
}) {
  const [streakDays, setStreakDays] = useState<boolean[]>([
    true,
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  const [readToday, setReadToday] = useState(false);

  const toggleDay = (idx: number) => {
    setStreakDays((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const nearYouCircles = [
    {
      id: 'fatima',
      title: 'Sisters Tajweed',
      masjid: 'Jamia Fatima Hall',
      when: 'Sat · After Asr (4:45 PM)',
      section: 'Sisters',
      dist: '1.2 km',
      img: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 'dha',
      title: 'Surah Yaseen Halqa',
      masjid: 'DHA Phase 4 Masjid',
      when: 'Fri · After Maghrib',
      section: 'Families',
      dist: '2.1 km',
      img: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 'model',
      title: 'Fajr Tadabbur',
      masjid: 'Model Town Central',
      when: 'Daily · After Fajr',
      section: 'Brothers',
      dist: '2.6 km',
      img: 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?auto=format&fit=crop&w=500&q=80',
    },
  ];

  return (
    <div className="artboard-row">
      {/* ======================================================================
          ARTBOARD 01: HOME — ABOVE THE FOLD (CIRCLE-FIRST HERO + NEARBY)
          Matches real HomeScreen.tsx: NextCircleCard sitting half on green header,
          Search + Filter bar, PrayerStrip, Near You PictureCards, and Dora card.
         ====================================================================== */}
      {(filter === 'all' || filter === 'home-main') && (
        <div className="artboard-col">
          <div className="artboard-caption">
            <span>01. Home — Next Circle & Nearby (Above Fold)</span>
            <span>375 × 812</span>
          </div>

          <div className="ios-artboard">
            {/* Top Emerald Atmospheric Header */}
            <div className="iq-hero-gradient" style={{ paddingBottom: 72 }}>
              <div className="iq-status-row">
                <span>9:41</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <PhIcon name="cell-signal-full" weight="bold" size={13} />
                  <PhIcon name="wifi-high" weight="bold" size={13} />
                  <PhIcon name="battery-full" weight="fill" size={15} />
                </div>
              </div>

              <div className="iq-top-nav">
                <button type="button" className="iq-location-trigger">
                  <PhIcon name="map-pin" weight="fill" size={13} />
                  <span>Lahore · Gulberg III</span>
                  <PhIcon name="caret-down" weight="bold" size={11} />
                </button>

                <div className="iq-header-right">
                  <span className="iq-season-pill">14 RAMADAN</span>
                  <button
                    type="button"
                    className="iq-bell-btn"
                    onClick={() => onNavigatePage('quran')}
                    title="Updates"
                  >
                    <PhIcon name="bell" weight="fill" size={16} />
                    <span className="iq-bell-dot" />
                  </button>
                </div>
              </div>
            </div>

            {/* OVERLAPPING HERO CARD: NextCircleCard ("Your Next Circle") */}
            <div
              className="iq-white-card"
              style={{
                margin: '-54px 20px 0',
                position: 'relative',
                zIndex: 6,
                boxShadow: '0 14px 34px -6px rgba(17, 24, 39, 0.09)',
                padding: 18,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <PhIcon name="check-circle" weight="fill" size={14} />
                  Your next circle · in 1h 45m
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                    background: '#F8FAFC',
                    padding: '3px 9px',
                    borderRadius: 999,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  Brothers
                </span>
              </div>

              <div style={{ cursor: 'pointer' }} onClick={() => onNavigatePage('session')}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#111827',
                    letterSpacing: '-0.015em',
                  }}
                >
                  Tafseer Surah Al-Kahf
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748B',
                    marginTop: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PhIcon name="map-pin" weight="regular" size={13} />
                  <span>Jamia Masjid Al-Noor, Gulberg III · 0.8 km</span>
                </div>

                {/* Split Clock + Portion Line */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: '#111827',
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      7:30
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>PM</span>
                    <span style={{ fontSize: 11.5, color: '#94A3B8', marginLeft: 4 }}>
                      · After Maghrib
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#B45309',
                      background: '#FFFBEB',
                      padding: '4px 10px',
                      borderRadius: 999,
                    }}
                  >
                    Al-Kahf : 1–31
                  </span>
                </div>
              </div>

              {/* Dual Action Buttons (Directions + My Registration) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.15fr',
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  className="iq-pill-cta"
                  onClick={() => onNavigatePage('session')}
                >
                  <PhIcon name="path" weight="regular" size={14} />
                  <span>Directions</span>
                </button>
                <button
                  type="button"
                  className="iq-pill-cta"
                  style={{ background: '#111827', color: '#FFFFFF', borderColor: '#111827' }}
                  onClick={() => onNavigatePage('session')}
                >
                  <span>My Registration</span>
                  <PhIcon name="arrow-right" weight="regular" size={13} />
                </button>
              </div>
            </div>

            {/* Search + Filter Trigger Row (home-search + home-filters) */}
            <div style={{ padding: '16px 20px 0', display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => onNavigatePage('nearby')}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 999,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#64748B',
                  fontSize: 12.5,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                <PhIcon name="magnifying-glass" weight="regular" size={16} color="#64748B" />
                <span>Search masjid, area, or surah…</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('nearby')}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#1E563B',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Filter circles"
              >
                <PhIcon name="sliders-horizontal" weight="bold" size={16} />
              </button>
            </div>

            {/* Compact 5-Waqt Prayer Strip (Anchors Circle Times) */}
            <div style={{ padding: '14px 20px 0' }}>
              <div
                style={{
                  background: '#F8FAFC',
                  borderRadius: 16,
                  padding: '10px 12px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  textAlign: 'center',
                }}
              >
                {[
                  { n: 'Fajr', t: '4:42', a: false },
                  { n: 'Dhuhr', t: '12:15', a: false },
                  { n: 'Asr', t: '4:35', a: false },
                  { n: 'Maghrib', t: '6:28', a: true },
                  { n: 'Isha', t: '7:55', a: false },
                ].map((p) => (
                  <div
                    key={p.n}
                    style={{
                      padding: '4px 2px',
                      borderRadius: 10,
                      background: p.a ? '#FFFFFF' : 'transparent',
                      boxShadow: p.a ? '0 2px 6px rgba(0,0,0,0.04)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: p.a ? 700 : 500,
                        color: p.a ? '#1E563B' : '#64748B',
                      }}
                    >
                      {p.n}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: p.a ? 700 : 500,
                        color: p.a ? '#111827' : '#94A3B8',
                        marginTop: 1,
                      }}
                    >
                      {p.t}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Circles Near You (Portrait Mosque Cards) */}
            <div className="iq-section" style={{ paddingRight: 0, paddingTop: 18 }}>
              <div className="iq-section-head" style={{ paddingRight: 20 }}>
                <span className="iq-section-title">Circles Near You</span>
                <button
                  type="button"
                  className="iq-see-more"
                  onClick={() => onNavigatePage('nearby')}
                >
                  See All 14 <PhIcon name="caret-right" weight="bold" size={11} />
                </button>
              </div>

              <div className="iq-photo-row" style={{ paddingLeft: 0 }}>
                {nearYouCircles.map((c) => (
                  <div
                    key={c.id}
                    className="iq-photo-card"
                    style={{ height: 168 }}
                    onClick={() => onNavigatePage('session')}
                  >
                    <img src={c.img} alt={c.masjid} loading="lazy" />
                    <div className="iq-photo-shade">
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                      >
                        <span className="iq-photo-tag">{c.dist}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#A7F3D0' }}>
                          {c.section}
                        </div>
                        <div
                          style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, marginTop: 1 }}
                        >
                          {c.title}
                        </div>
                        <div
                          style={{ fontSize: 10, color: 'rgba(255,255,255,0.82)', marginTop: 2 }}
                        >
                          {c.masjid}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Secondary Program Card: Dora-e-Quran */}
            <div className="iq-section" style={{ paddingTop: 16 }}>
              <div
                className="iq-white-card"
                style={{
                  padding: '13px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={() => onNavigatePage('session')}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>
                    Ramadan Dora-e-Quran · Tonight 9:00 PM
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', marginTop: 2 }}>
                    Juz 15 Tafseer · Jamia Ashrafia Hall
                  </div>
                </div>
                <PhIcon name="caret-right" weight="bold" size={15} color="#94A3B8" />
              </div>
            </div>

            {/* Floating 5-Icon Pill Navigation Dock */}
            <nav className="iq-floating-nav" aria-label="Bottom Navigation">
              <button type="button" className="iq-nav-icon-btn active" title="Home">
                <PhIcon name="house" weight="fill" size={20} />
              </button>
              <button
                type="button"
                className="iq-nav-icon-btn"
                title="Nearby Circles"
                onClick={() => onNavigatePage('nearby')}
              >
                <PhIcon name="compass" weight="regular" size={20} />
              </button>
              <button
                type="button"
                className="iq-nav-icon-btn"
                title="Quran & Prayer"
                onClick={() => onNavigatePage('quran')}
              >
                <PhIcon name="book-open" weight="regular" size={20} />
              </button>
              <button
                type="button"
                className="iq-nav-icon-btn"
                title="My Journey"
                onClick={() => onNavigatePage('session')}
              >
                <PhIcon name="bookmarks" weight="regular" size={20} />
              </button>
              <button type="button" className="iq-nav-icon-btn" title="Profile">
                <PhIcon name="user-circle" weight="regular" size={20} />
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* ======================================================================
          ARTBOARD 02: HOME — BELOW THE FOLD
          (ReadAlongCard + MapPreviewCard + AyahOfTheDayCard + DaysRead + CommunityToday)
         ====================================================================== */}
      {(filter === 'all' || filter === 'home-below') && (
        <div className="artboard-col">
          <div className="artboard-caption">
            <span>02. Home — Below Fold (Portion, Map, Ayah & Streak)</span>
            <span>375 × 812</span>
          </div>

          <div className="ios-artboard" style={{ paddingTop: 14 }}>
            <div
              className="iq-status-row"
              style={{ padding: '0 20px', color: '#111827', marginBottom: 4 }}
            >
              <span>9:41</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <PhIcon name="cell-signal-full" weight="bold" size={13} />
                <PhIcon name="wifi-high" weight="bold" size={13} />
                <PhIcon name="battery-full" weight="fill" size={15} />
              </div>
            </div>

            {/* 1. ReadAlongCard ("Read Tonight's Portion") */}
            <div className="iq-section" style={{ paddingTop: 8 }}>
              <div className="iq-section-head">
                <span className="iq-section-title">Read Tonight&apos;s Portion</span>
                <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>
                  7:30 PM Circle
                </span>
              </div>

              <div className="iq-white-card" style={{ padding: 16 }}>
                <div className="iq-card-top-row">
                  <div>
                    <div className="iq-card-title">Surah Al-Kahf : Ayahs 1–31</div>
                    <div className="iq-card-sub">Set by Ustadh Ahmad · Masjid Al-Noor</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-quran)', fontSize: 18, color: '#1E563B' }}>
                    الكهف
                  </span>
                </div>

                <div className="iq-arabic-display" style={{ fontSize: 19, margin: '12px 0 12px' }}>
                  ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ عَلَىٰ عَبْدِهِ ٱلْكِتَـٰبَ{' '}
                  <AyahMedallion number={1} size={26} />
                </div>

                <button
                  type="button"
                  className="iq-pill-cta"
                  onClick={() => onNavigatePage('quran')}
                >
                  <span>Open Portion in Reader</span>
                  <PhIcon name="arrow-right" weight="regular" size={13} />
                </button>
              </div>
            </div>

            {/* 2. MapPreviewCard ("14 Circles on the Lahore Map") */}
            <div className="iq-section" style={{ paddingTop: 18 }}>
              <div className="iq-section-head">
                <span className="iq-section-title">Explore on Map</span>
                <button
                  type="button"
                  className="iq-see-more"
                  onClick={() => onNavigatePage('nearby')}
                >
                  Open Map <PhIcon name="caret-right" weight="bold" size={11} />
                </button>
              </div>

              <div
                style={{
                  height: 118,
                  borderRadius: 20,
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                }}
                onClick={() => onNavigatePage('nearby')}
              >
                <svg
                  width="100%"
                  height="118"
                  viewBox="0 0 335 118"
                  preserveAspectRatio="xMidYMid slice"
                >
                  <rect width="335" height="118" fill="#EFF7F3" />
                  <rect x="14" y="10" width="84" height="46" rx="10" fill="#DCEEE4" />
                  <rect x="220" y="16" width="95" height="54" rx="10" fill="#DCEEE4" />
                  <path d="M 0 88 Q 140 62, 335 78" stroke="#BAE6FD" strokeWidth="10" fill="none" />
                  <g stroke="#FFFFFF" strokeWidth="5">
                    <line x1="0" y1="36" x2="335" y2="36" />
                    <line x1="105" y1="0" x2="90" y2="118" />
                    <line x1="215" y1="0" x2="230" y2="118" />
                  </g>
                  <circle cx="118" cy="36" r="14" fill="#1E563B" fillOpacity="0.18" />
                  <circle cx="118" cy="36" r="7" fill="#1E563B" stroke="#FFF" strokeWidth="2" />
                  <circle cx="205" cy="48" r="6" fill="#3B8861" stroke="#FFF" strokeWidth="2" />
                  <circle cx="265" cy="32" r="6" fill="#3B8861" stroke="#FFF" strokeWidth="2" />
                </svg>

                <div
                  style={{
                    position: 'absolute',
                    left: 10,
                    right: 10,
                    bottom: 10,
                    background: 'rgba(255,255,255,0.94)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                      14 Circles in Lahore
                    </div>
                    <div style={{ fontSize: 10.5, color: '#64748B' }}>
                      Nearest is 800m away at Masjid Al-Noor
                    </div>
                  </div>
                  <PhIcon name="arrow-up-right" weight="bold" size={14} color="#1E563B" />
                </div>
              </div>
            </div>

            {/* 3. AyahOfTheDayCard (Picked by Masjid Coordinator) */}
            <div className="iq-section" style={{ paddingTop: 18 }}>
              <div className="iq-section-head">
                <span className="iq-section-title">Ayah of the Day</span>
                <span style={{ fontSize: 11, color: '#1E563B', fontWeight: 600 }}>
                  From Masjid Al-Noor
                </span>
              </div>

              <div className="iq-white-card" style={{ padding: 16 }}>
                <div className="iq-arabic-display" style={{ fontSize: 18.5, margin: '2px 0 8px' }}>
                  وَٱصْبِرْ نَفْسَكَ مَعَ ٱلَّذِينَ يَدْعُونَ رَبَّهُم{' '}
                  <AyahMedallion number={28} size={26} />
                </div>
                <div
                  style={{ fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 1.5 }}
                >
                  &ldquo;And keep yourself patiently with those who call upon their Lord in the
                  morning and the evening…&rdquo; · <span style={{ color: '#94A3B8' }}>18:28</span>
                </div>
              </div>
            </div>

            {/* 4. DaysReadCard + CommunityTodayCard */}
            <div className="iq-section" style={{ paddingTop: 18 }}>
              <div className="iq-section-head">
                <span className="iq-section-title">Days Read</span>
                <button
                  type="button"
                  onClick={() => setReadToday(!readToday)}
                  style={{
                    border: 'none',
                    background: readToday ? '#D1FAE5' : '#F1F5F9',
                    color: readToday ? '#059669' : '#334155',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {readToday ? '✓ Counted Today' : '+ I read today'}
                </button>
              </div>

              <div className="iq-streak-box" style={{ padding: '12px 10px' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                  const done = streakDays[idx] || (idx === 4 && readToday);
                  return (
                    <div
                      key={idx}
                      className="iq-streak-day"
                      onClick={() => toggleDay(idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={`iq-streak-dot ${done ? 'done' : ''}`}>
                        <PhIcon name="check" weight="bold" size={12} />
                      </div>
                      <span className="iq-streak-label">{day}</span>
                    </div>
                  );
                })}
              </div>

              {/* CommunityTodayCard Solidarity Line */}
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11.5,
                  color: '#475569',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <PhIcon name="users-three" weight="duotone" size={16} color="#1E563B" />
                  1,420 people read together today
                </span>
                <span style={{ fontWeight: 700, color: '#1E563B' }}>4,890 pages</span>
              </div>
            </div>

            <nav className="iq-floating-nav">
              <button type="button" className="iq-nav-icon-btn active">
                <PhIcon name="house" weight="fill" size={20} />
              </button>
              <button
                type="button"
                className="iq-nav-icon-btn"
                onClick={() => onNavigatePage('nearby')}
              >
                <PhIcon name="compass" weight="regular" size={20} />
              </button>
              <button
                type="button"
                className="iq-nav-icon-btn"
                onClick={() => onNavigatePage('quran')}
              >
                <PhIcon name="book-open" weight="regular" size={20} />
              </button>
              <button
                type="button"
                className="iq-nav-icon-btn"
                onClick={() => onNavigatePage('session')}
              >
                <PhIcon name="bookmarks" weight="regular" size={20} />
              </button>
              <button type="button" className="iq-nav-icon-btn">
                <PhIcon name="user-circle" weight="regular" size={20} />
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* ======================================================================
          ARTBOARD 03: HOME — CITY & NEIGHBOURHOOD PICKER SHEET
         ====================================================================== */}
      {(filter === 'all' || filter === 'home-location') && (
        <div className="artboard-col">
          <div className="artboard-caption">
            <span>03. Home — City & Area Picker Sheet</span>
            <span>375 × 812</span>
          </div>

          <div className="ios-artboard" style={{ paddingBottom: 0 }}>
            <div className="iq-hero-gradient" style={{ filter: 'brightness(0.75)', height: 180 }}>
              <div className="iq-status-row">
                <span>9:41</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <PhIcon name="cell-signal-full" weight="bold" size={13} />
                  <PhIcon name="wifi-high" weight="bold" size={13} />
                  <PhIcon name="battery-full" weight="fill" size={15} />
                </div>
              </div>
              <div className="iq-top-nav">
                <span className="iq-location-trigger">
                  <PhIcon name="map-pin" weight="fill" size={13} /> Lahore · Gulberg III
                </span>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                marginTop: -48,
                background: '#FFFFFF',
                borderRadius: '28px 28px 0 0',
                padding: '14px 20px 28px',
                position: 'relative',
                zIndex: 10,
                boxShadow: '0 -12px 36px rgba(0,0,0,0.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 999,
                  background: '#E2E8F0',
                  margin: '0 auto',
                }}
              />

              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  Choose Your Area
                </span>
                <button
                  type="button"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    background: '#F1F5F9',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <PhIcon name="x" weight="bold" size={13} />
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 999,
                  padding: '10px 16px',
                }}
              >
                <PhIcon name="magnifying-glass" weight="regular" size={16} color="#64748B" />
                <span style={{ fontSize: 13, color: '#64748B' }}>
                  Search city or neighbourhood…
                </span>
              </div>

              <button type="button" className="iq-pill-cta">
                <PhIcon name="navigation-arrow" weight="fill" size={13} color="#10B981" />
                <span>Use current GPS location</span>
              </button>

              {/* City Pills */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                {['Lahore (14)', 'Islamabad (9)', 'Karachi (18)', 'Rawalpindi (6)'].map((c, i) => (
                  <span
                    key={c}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: i === 0 ? '#111827' : '#F8FAFC',
                      color: i === 0 ? '#FFFFFF' : '#475569',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { area: 'Gulberg III, Lahore', sub: 'Masjid Al-Noor, Jamia Fatima · 6 Circles' },
                  { area: 'DHA Phase 4 & 5, Lahore', sub: 'Central Masjid, Sector CC · 4 Circles' },
                  { area: 'Model Town, Lahore', sub: 'Block C & Central Park Masjid · 3 Circles' },
                  { area: 'Johar Town, Lahore', sub: 'Block G & Canal View Masjid · 5 Circles' },
                ].map((loc, idx) => (
                  <div
                    key={loc.area}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 6px',
                      borderBottom: '1px solid #F8FAFC',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <PhIcon
                        name="map-pin"
                        weight="fill"
                        size={17}
                        color={idx === 0 ? '#10B981' : '#94A3B8'}
                      />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>
                          {loc.area}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                          {loc.sub}
                        </div>
                      </div>
                    </div>
                    {idx === 0 && <PhIcon name="check" weight="bold" size={15} color="#10B981" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
