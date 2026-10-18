import React from 'react';
import { PhIcon } from './icons';

export function ArtboardsNearby({ onNavigatePage }: { onNavigatePage: (page: string) => void }) {
  const sessions = [
    {
      title: 'Tafseer Surah Al-Kahf',
      masjid: 'Jamia Masjid Al-Noor, Gulberg III',
      when: 'Thu · 7:30 PM (After Maghrib)',
      portion: 'Al-Kahf : 1–31',
      section: 'Brothers',
      seats: '22 seats left',
      dist: '0.8 km',
    },
    {
      title: 'Sisters Tajweed & Juz Amma',
      masjid: 'Jamia Fatima Zahra Hall, Cavalry',
      when: 'Sat · 4:45 PM (After Asr)',
      portion: 'Al-Mulk : 1–30',
      section: 'Sisters',
      seats: '3 seats left',
      dist: '1.2 km',
    },
    {
      title: 'Ramadan Dora-e-Quran · Juz 15',
      masjid: 'DHA Phase 4 Central Masjid',
      when: 'Daily · 9:00 PM (After Isha)',
      portion: 'Surah Al-Isra',
      section: 'Families',
      seats: 'Open Hall',
      dist: '2.1 km',
    },
  ];

  return (
    <div className="artboard-row">
      {/* ======================================================================
          ARTBOARD 01: NEARBY — LIST VIEW
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>01. Nearby — List View & Filter Chips</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14 }}>
          <div
            className="iq-status-row"
            style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}
          >
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PhIcon name="cell-signal-full" weight="bold" size={13} />
              <PhIcon name="wifi-high" weight="bold" size={13} />
              <PhIcon name="battery-full" weight="fill" size={15} />
            </div>
          </div>

          <div
            style={{
              padding: '0 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}
            >
              Nearby Circles
            </div>
            {/* Segmented List / Map Pill */}
            <div
              style={{
                display: 'inline-flex',
                background: '#F1F5F9',
                padding: 3,
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  background: '#FFFFFF',
                  color: '#111827',
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 999,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                List
              </span>
              <span
                style={{
                  color: '#64748B',
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '5px 12px',
                }}
              >
                Map
              </span>
            </div>
          </div>

          {/* SearchField Pill */}
          <div style={{ padding: '14px 20px 0' }}>
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
              <span style={{ fontSize: 12.5, color: '#64748B' }}>
                Search masjid, ustadh, or surah…
              </span>
            </div>
          </div>

          {/* Filter Chips Row */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              padding: '12px 20px 4px',
              scrollbarWidth: 'none',
            }}
          >
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: '#111827',
                color: '#FFFFFF',
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <PhIcon name="map-pin" weight="fill" size={12} color="#10B981" />
              Gulberg III
            </span>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: '#E8F5EE',
                color: '#1E563B',
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              After Maghrib ×
            </span>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#475569',
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Section: All ▾
            </span>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#475569',
                fontSize: 11.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Day ▾
            </span>
          </div>

          {/* Vertical SessionCard Stack */}
          <div
            style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {sessions.map((s) => (
              <div
                key={s.title}
                className="iq-white-card"
                style={{ padding: 16, cursor: 'pointer' }}
                onClick={() => onNavigatePage('session')}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1E563B' }}>
                    {s.section} · {s.dist}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#B45309',
                      background: '#FFFBEB',
                      padding: '3px 8px',
                      borderRadius: 999,
                    }}
                  >
                    {s.portion}
                  </span>
                </div>

                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{s.masjid}</div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid #F8FAFC',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: '#334155', fontWeight: 600 }}>{s.when}</span>
                  <span style={{ color: '#111827', fontWeight: 700 }}>{s.seats} →</span>
                </div>
              </div>
            ))}
          </div>

          <nav className="iq-floating-nav">
            <button
              type="button"
              className="iq-nav-icon-btn"
              onClick={() => onNavigatePage('home')}
            >
              <PhIcon name="house" weight="regular" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn active">
              <PhIcon name="compass" weight="fill" size={20} />
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

      {/* ======================================================================
          ARTBOARD 02: NEARBY — MAP VIEW WITH SELECTED MASJID DRAWER
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>02. Nearby — Map View & Selected Masjid Card</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ padding: 0 }}>
          {/* Full-Screen Vector Map Canvas */}
          <div style={{ position: 'relative', width: '100%', height: 812 }}>
            <svg
              width="375"
              height="812"
              viewBox="0 0 375 812"
              preserveAspectRatio="xMidYMid slice"
            >
              <rect width="375" height="812" fill="#EDF6F1" />
              <rect x="20" y="90" width="130" height="110" rx="20" fill="#D8ECE1" />
              <rect x="220" y="260" width="140" height="140" rx="24" fill="#D8ECE1" />
              <path
                d="M -10 380 Q 170 310, 385 350"
                stroke="#BAE6FD"
                strokeWidth="24"
                fill="none"
              />
              <g stroke="#FFFFFF" strokeWidth="8">
                <line x1="0" y1="180" x2="375" y2="180" />
                <line x1="0" y1="450" x2="375" y2="450" />
                <line x1="125" y1="0" x2="95" y2="812" />
                <line x1="255" y1="0" x2="280" y2="812" />
              </g>

              {/* Selected Masjid Pin (0.8 km) */}
              <g transform="translate(155, 220)">
                <circle r="28" fill="#1E563B" fillOpacity="0.18" />
                <rect x="-34" y="-16" width="68" height="28" rx="14" fill="#111827" />
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans"
                >
                  7:30 PM
                </text>
              </g>

              {/* Secondary Masjid Pins */}
              <g transform="translate(260, 310)">
                <rect
                  x="-30"
                  y="-14"
                  width="60"
                  height="24"
                  rx="12"
                  fill="#FFFFFF"
                  stroke="#1E563B"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  fill="#1E563B"
                  fontSize="10.5"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans"
                >
                  4:45 PM
                </text>
              </g>
              <g transform="translate(105, 430)">
                <rect
                  x="-30"
                  y="-14"
                  width="60"
                  height="24"
                  rx="12"
                  fill="#FFFFFF"
                  stroke="#1E563B"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  fill="#1E563B"
                  fontSize="10.5"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans"
                >
                  9:00 PM
                </text>
              </g>
            </svg>

            {/* Floating Top Search + Segmented Control */}
            <div style={{ position: 'absolute', top: 14, left: 20, right: 20 }}>
              <div className="iq-status-row" style={{ color: '#111827', marginBottom: 10 }}>
                <span>9:41</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <PhIcon name="cell-signal-full" weight="bold" size={13} />
                  <PhIcon name="wifi-high" weight="bold" size={13} />
                  <PhIcon name="battery-full" weight="fill" size={15} />
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 999,
                  padding: '8px 8px 8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>
                  Gulberg III · 14 Circles
                </span>
                <span
                  style={{
                    background: '#111827',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '6px 12px',
                    borderRadius: 999,
                  }}
                >
                  List View
                </span>
              </div>
            </div>

            {/* Selected Masjid Floating Card Above Dock */}
            <div
              className="iq-white-card"
              style={{
                position: 'absolute',
                left: 20,
                right: 20,
                bottom: 90,
                boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
                  Jamia Masjid Al-Noor · 0.8 km
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#B45309',
                    background: '#FFFBEB',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  Al-Kahf : 1–31
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
                Tafseer Surah Al-Kahf
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Tonight · 7:30 PM (After Maghrib) · Brothers
              </div>
              <button
                type="button"
                className="iq-pill-cta"
                style={{ marginTop: 12 }}
                onClick={() => onNavigatePage('session')}
              >
                <span>Open Circle Details</span>
                <PhIcon name="arrow-right" weight="regular" size={13} />
              </button>
            </div>

            <nav className="iq-floating-nav">
              <button
                type="button"
                className="iq-nav-icon-btn"
                onClick={() => onNavigatePage('home')}
              >
                <PhIcon name="house" weight="regular" size={20} />
              </button>
              <button type="button" className="iq-nav-icon-btn active">
                <PhIcon name="compass" weight="fill" size={20} />
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
      </div>

      {/* ======================================================================
          ARTBOARD 03: NEARBY — FILTERS BOTTOM SHEET (Time Band, Section, Program)
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>03. Nearby — Filters Sheet (Waqt, Section, Program)</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ background: '#CBD5E1', paddingBottom: 0 }}>
          <div style={{ padding: '14px 20px', opacity: 0.45 }}>
            <div className="iq-status-row" style={{ color: '#111827' }}>
              <span>9:41</span>
              <span>100%</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Nearby Circles</div>
          </div>

          <div
            style={{
              flex: 1,
              marginTop: 24,
              background: '#FFFFFF',
              borderRadius: '28px 28px 0 0',
              padding: '14px 20px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxShadow: '0 -12px 36px rgba(0,0,0,0.15)',
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>
                Filter Circles
              </span>
              <span
                style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B', cursor: 'pointer' }}
              >
                Reset all
              </span>
            </div>

            {/* 1. Prayer Time Band */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                Prayer Time Band
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { l: 'After Fajr', sel: false },
                  { l: 'After Asr', sel: false },
                  { l: 'After Maghrib', sel: true },
                  { l: 'After Isha', sel: false },
                ].map((b) => (
                  <div
                    key={b.l}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 14,
                      border: b.sel ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                      background: b.sel ? '#ECFDF5' : '#FFFFFF',
                      color: b.sel ? '#065F46' : '#334155',
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{b.l}</span>
                    {b.sel && (
                      <PhIcon name="check-circle" weight="fill" size={15} color="#10B981" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Section */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                Section
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Brothers', 'Sisters Only', 'Families', 'Mixed Hall'].map((sec, i) => (
                  <span
                    key={sec}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: i === 0 ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                      background: i === 0 ? '#ECFDF5' : '#FFFFFF',
                      color: i === 0 ? '#065F46' : '#334155',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {sec}
                  </span>
                ))}
              </div>
            </div>

            {/* 3. Program Type */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                Program
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['All Programs', 'Weekly Halqa', 'Dora-e-Quran'].map((prog, i) => (
                  <span
                    key={prog}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: i === 0 ? '1.5px solid #111827' : '1px solid #E2E8F0',
                      background: i === 0 ? '#111827' : '#FFFFFF',
                      color: i === 0 ? '#FFFFFF' : '#334155',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {prog}
                  </span>
                ))}
              </div>
            </div>

            {/* 4. Language */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
                Language
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Urdu', 'English', 'Arabic'].map((lang, i) => (
                  <span
                    key={lang}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      border: i < 2 ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                      background: i < 2 ? '#ECFDF5' : '#FFFFFF',
                      color: i < 2 ? '#065F46' : '#334155',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            <button type="button" className="iq-pill-cta dark" style={{ marginTop: 'auto' }}>
              Show 14 Matching Circles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
