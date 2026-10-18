import React, { useState } from 'react';
import { PhIcon, AyahMedallion } from './icons';

export function ArtboardsAdmin({
  onNavigatePage,
}: {
  filter?: string;
  onNavigatePage?: (page: string) => void;
} = {}) {
  const [count, setCount] = useState(34);
  const [checkedInPasses, setCheckedInPasses] = useState<Record<string, boolean>>({
    '#QC-8841': true,
    '#QC-8839': false,
    '#QC-8834': false,
  });
  const [rosterFilter, setRosterFilter] = useState<'all' | 'checked' | 'pending'>('all');
  const [selectedTopic, setSelectedTopic] = useState('Surah Al-Kahf');

  const togglePass = (code: string, seats: number) => {
    setCheckedInPasses((prev) => {
      const next = !prev[code];
      setCount((c) => (next ? c + seats : Math.max(0, c - seats)));
      return { ...prev, [code]: next };
    });
  };

  const passList = [
    { name: 'Usman Khan', code: '#QC-8841', seats: 2, seatsLabel: '2 Seats' },
    { name: 'Bilal Ahmed', code: '#QC-8839', seats: 1, seatsLabel: '1 Seat' },
    { name: 'Zainab Tariq', code: '#QC-8834', seats: 3, seatsLabel: '3 Seats' },
  ];

  const rosterItems = [
    {
      name: 'Usman Khan',
      code: '#QC-8841',
      seats: '2 Seats · Brothers Hall',
      phone: '+92 300 419 8821',
      checkedIn: true,
    },
    {
      name: 'Bilal Ahmed',
      code: '#QC-8839',
      seats: '1 Seat · Brothers Hall',
      phone: '+92 321 844 1092',
      checkedIn: true,
    },
    {
      name: 'Zainab Tariq',
      code: '#QC-8834',
      seats: '3 Seats · Sisters Hall',
      phone: '+92 333 910 4418',
      checkedIn: false,
    },
    {
      name: 'Hamza Mahmood',
      code: '#QC-8828',
      seats: '2 Seats · Brothers Hall',
      phone: '+92 301 772 3309',
      checkedIn: false,
    },
  ];

  const filteredRoster = rosterItems.filter((r) => {
    if (rosterFilter === 'checked') return r.checkedIn;
    if (rosterFilter === 'pending') return !r.checkedIn;
    return true;
  });

  const trendDays = [
    { day: 'Fri', val: 38, active: false },
    { day: 'Sat', val: 26, active: false },
    { day: 'Sun', val: 31, active: false },
    { day: 'Mon', val: 22, active: false },
    { day: 'Tue', val: 29, active: false },
    { day: 'Wed', val: 27, active: false },
    { day: 'Thu', val: 34, active: true },
  ];

  return (
    <div className="artboard-row">
      {/* ======================================================================
          ARTBOARD 01: 01. TodayScreen — Masjid Scope & Tonight's Halqa
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>01. TodayScreen — Masjid Scope &amp; Tonight&apos;s Halqa</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard">
          {/* Atmospheric Emerald Header */}
          <div className="iq-hero-gradient" style={{ paddingBottom: 68 }}>
            <div className="iq-status-row">
              <span>7:25</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <PhIcon name="cell-signal-full" weight="bold" size={13} />
                <PhIcon name="wifi-high" weight="bold" size={13} />
                <PhIcon name="battery-full" weight="fill" size={15} />
              </div>
            </div>

            <div className="iq-top-nav">
              <button
                type="button"
                className="iq-location-trigger"
                style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  padding: '6px 12px',
                  borderRadius: 999,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <PhIcon name="mosque" weight="fill" size={14} />
                <span>Jamia Masjid Al-Noor · Lahore</span>
                <PhIcon name="caret-down" weight="bold" size={11} />
              </button>

              <button
                type="button"
                className="iq-bell-btn"
                title="Post Update"
                onClick={() => onNavigatePage?.('admin-manage')}
              >
                <PhIcon name="bell" weight="fill" size={16} />
                <span className="iq-bell-dot" />
              </button>
            </div>
          </div>

          {/* Tonight's Live Session Hero Card */}
          <div
            className="iq-white-card"
            style={{
              margin: '-48px 20px 0',
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
                Tonight&apos;s Live Halqa · Brothers Hall
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#B45309',
                  background: '#FFFBEB',
                  padding: '3px 9px',
                  borderRadius: 999,
                }}
              >
                Al-Kahf 1–31
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', letterSpacing: '-0.015em' }}>
              Tafseer Surah Al-Kahf
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#64748B',
                marginTop: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <PhIcon name="clock" weight="regular" size={13} />
              <span>7:30 PM After Maghrib · Ustadh Ahmad</span>
            </div>

            {/* Live Attendance & Reservation Pill Row */}
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 14,
                background: '#F8FAFC',
                border: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 700, color: '#1E563B', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <PhIcon name="users-three" weight="duotone" size={15} color="#1E563B" />
                34 Checked In / 18 Reserved
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>40 cap</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="iq-pill-cta"
                style={{ background: '#111827', color: '#FFFFFF', borderColor: '#111827' }}
              >
                <PhIcon name="clipboard-text" weight="fill" size={14} />
                <span>Log Attendance</span>
              </button>
              <button type="button" className="iq-pill-cta">
                <PhIcon name="users-three" weight="regular" size={14} />
                <span>Registrants (18)</span>
              </button>
            </div>
          </div>

          {/* 4 Quick Action Cards */}
          <div className="iq-section" style={{ paddingTop: 18 }}>
            <div className="iq-section-head">
              <span className="iq-section-title">Quick Actions</span>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>Masjid Tools</span>
            </div>

            <div className="iq-two-col">
              {[
                { l: 'Attendance', sub: '34 Present Tonight', ic: 'clipboard-text' },
                { l: 'Set Portion', sub: 'Al-Kahf : 1–31', ic: 'book-open-text' },
                { l: 'Post Update', sub: '42 Followers', ic: 'megaphone' },
                { l: 'QR Poster', sub: 'A4 & WhatsApp', ic: 'qr-code' },
              ].map((act) => (
                <div
                  key={act.l}
                  className="iq-mini-card"
                  style={{
                    gap: 8,
                    padding: '12px 14px',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: '#E8F5EE',
                      color: '#1E563B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PhIcon name={act.ic} weight="duotone" size={19} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{act.l}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#64748B',
                        marginTop: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {act.sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7-Day Attendance Trend Card */}
          <div className="iq-section" style={{ paddingTop: 16 }}>
            <div className="iq-section-head">
              <span className="iq-section-title">7-Day Attendance</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E563B' }}>
                217 total (+14%)
              </span>
            </div>

            <div className="iq-white-card" style={{ padding: '14px 16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 8,
                  alignItems: 'end',
                  height: 76,
                  paddingTop: 6,
                }}
              >
                {trendDays.map((d) => {
                  const pct = Math.round((d.val / 40) * 100);
                  return (
                    <div
                      key={d.day}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 5,
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: d.active ? '#1E563B' : '#94A3B8',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {d.val}
                      </span>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 24,
                          height: `${Math.max(20, pct * 0.48)}px`,
                          borderRadius: 6,
                          background: d.active ? '#1E563B' : '#E8F5EE',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: d.active ? 700 : 600,
                          color: d.active ? '#111827' : '#64748B',
                        }}
                      >
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <nav className="iq-floating-nav" aria-label="Coordinator Navigation">
            <button type="button" className="iq-nav-icon-btn active" title="Today">
              <PhIcon name="calendar-check" weight="fill" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn" title="Registrants">
              <PhIcon name="users-three" weight="regular" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn" title="Updates">
              <PhIcon name="megaphone" weight="regular" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn" title="Masjid Venue">
              <PhIcon name="mosque" weight="regular" size={20} />
            </button>
          </nav>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 02: 02. AttendanceScreen — Headcount Stepper & Pass Check-In
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>02. AttendanceScreen — Headcount Stepper &amp; Pass Check-In</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, paddingBottom: 24 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>7:45</span>
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
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#111827',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <PhIcon name="caret-left" weight="bold" size={14} /> Today
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Tonight&apos;s Attendance
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#059669' }}>Live</span>
          </div>

          {/* 1-Handed Live Headcount Stepper Card */}
          <div style={{ padding: '0 20px' }}>
            <div className="iq-white-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>
                  {count} Present Tonight
                </span>
                <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>
                  Includes walk-ins
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  margin: '14px 0',
                  padding: '10px 14px',
                  borderRadius: 18,
                  background: '#F8FAFC',
                  border: '1px solid #F1F5F9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 800,
                      color: '#111827',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {count}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>in hall</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCount(Math.max(0, count - 1))}
                    style={{
                      height: 38,
                      padding: '0 13px',
                      borderRadius: 999,
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#111827',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => setCount(count + 1)}
                    style={{
                      height: 38,
                      padding: '0 14px',
                      borderRadius: 999,
                      border: 'none',
                      background: '#1E563B',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setCount(count + 5)}
                    style={{
                      height: 38,
                      padding: '0 12px',
                      borderRadius: 999,
                      border: '1px solid #A7F3D0',
                      background: '#E8F5EE',
                      color: '#1E563B',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +5 Walk-In
                  </button>
                </div>
              </div>

              {/* SeatMeter Bar */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11.5,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#475569' }}>Hall SeatMeter</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: '#1E563B',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {count} / 40 capacity ({Math.min(100, Math.round((count / 40) * 100))}%)
                  </span>
                </div>
                <div
                  style={{
                    height: 7,
                    borderRadius: 999,
                    background: '#F1F5F9',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((count / 40) * 100))}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: '#10B981',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Registrant Pass Check-In List */}
          <div className="iq-section" style={{ paddingTop: 18, flex: 1 }}>
            <div className="iq-section-head">
              <span className="iq-section-title">Registrant Pass Check-In</span>
              <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>
                12 / 18 Checked In
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {passList.map((r) => {
                const isChecked = Boolean(checkedInPasses[r.code]);
                return (
                  <div
                    key={r.code}
                    className="iq-white-card"
                    onClick={() => togglePass(r.code, r.seats)}
                    style={{
                      padding: '13px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          background: isChecked ? '#E8F5EE' : '#F8FAFC',
                          color: isChecked ? '#1E563B' : '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PhIcon
                          name={isChecked ? 'check-circle' : 'ticket'}
                          weight={isChecked ? 'fill' : 'duotone'}
                          size={19}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                          {r.code} · {r.seatsLabel}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        background: isChecked ? '#D1FAE5' : '#F8FAFC',
                        border: isChecked ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                        color: isChecked ? '#065F46' : '#334155',
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      {isChecked ? '✓ Checked In' : 'Check In'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '16px 20px 0', marginTop: 'auto' }}>
            <button type="button" className="iq-pill-cta dark">
              <PhIcon name="check-circle" weight="fill" size={16} />
              <span>Save Attendance ({count} Present)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 03: 03. RegistrantsScreen — Roster, Search & WhatsApp Contact
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>03. RegistrantsScreen — Roster, Search &amp; WhatsApp Contact</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, paddingBottom: 24 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>7:45</span>
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
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#111827',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <PhIcon name="caret-left" weight="bold" size={14} /> Today
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Tonight&apos;s Registrants
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1E563B' }}>18 Passes</span>
          </div>

          {/* Search Bar */}
          <div style={{ padding: '0 20px', marginBottom: 12 }}>
            <div
              style={{
                height: 40,
                borderRadius: 999,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#64748B',
                fontSize: 12.5,
              }}
            >
              <PhIcon name="magnifying-glass" weight="regular" size={15} color="#64748B" />
              <span>Search name, pass #QC, or phone…</span>
            </div>
          </div>

          {/* Filter Pills: All (18), Checked In (12), Pending (6) */}
          <div style={{ padding: '0 20px', display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { id: 'all' as const, label: 'All (18)' },
              { id: 'checked' as const, label: 'Checked In (12)' },
              { id: 'pending' as const, label: 'Pending (6)' },
            ].map((tab) => {
              const active = rosterFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRosterFilter(tab.id)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 999,
                    border: active ? '1px solid #111827' : '1px solid #E2E8F0',
                    background: active ? '#111827' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Registrant Cards with Seat Counts, Phone Numbers, and 1-Tap WhatsApp / Call Pills */}
          <div
            style={{
              padding: '0 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flex: 1,
            }}
          >
            {filteredRoster.map((r) => (
              <div key={r.code} className="iq-white-card" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                        {r.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: r.checkedIn ? '#059669' : '#64748B',
                          background: r.checkedIn ? '#E8F5EE' : '#F8FAFC',
                          padding: '2px 7px',
                          borderRadius: 999,
                        }}
                      >
                        {r.code}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                      {r.seats} · {r.phone}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 999,
                      border: '1px solid #A7F3D0',
                      background: '#E8F5EE',
                      color: '#1E563B',
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <PhIcon name="whatsapp-logo" weight="fill" size={14} color="#1E563B" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 999,
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#334155',
                      fontSize: 11.5,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <PhIcon name="phone-call" weight="regular" size={14} color="#334155" />
                    <span>Call</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Export Roster CSV Bottom Action */}
          <div style={{ padding: '14px 20px 0', marginTop: 'auto' }}>
            <button type="button" className="iq-pill-cta dark">
              <PhIcon name="file-csv" weight="duotone" size={17} />
              <span>Export Roster CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 04: 04. DailyAyahScreen — Masjid Ayah of the Day Picker
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>04. DailyAyahScreen — Masjid Ayah of the Day Picker</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, paddingBottom: 24 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>7:50</span>
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
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#111827',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <PhIcon name="caret-left" weight="bold" size={14} /> Masjid
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Daily Ayah Picker
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1E563B' }}>Al-Noor</span>
          </div>

          {/* 5-Day Schedule Strip */}
          <div style={{ padding: '0 20px', marginBottom: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 6,
                background: '#F8FAFC',
                padding: 6,
                borderRadius: 16,
                border: '1px solid #F1F5F9',
              }}
            >
              {[
                { d: 'Today', num: '18', active: true, picked: true },
                { d: 'Sat', num: '19', active: false, picked: true },
                { d: 'Sun', num: '20', active: false, picked: false },
                { d: 'Mon', num: '21', active: false, picked: false },
                { d: 'Tue', num: '22', active: false, picked: false },
              ].map((item) => (
                <div
                  key={item.num}
                  style={{
                    padding: '6px 4px',
                    borderRadius: 12,
                    background: item.active ? '#1E563B' : 'transparent',
                    color: item.active ? '#FFFFFF' : '#475569',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, opacity: item.active ? 0.9 : 0.75 }}>
                    {item.d}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 1 }}>{item.num}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Curated Topic Chips */}
          <div style={{ padding: '0 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
              Curated Masjid Themes
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Patience', 'Surah Al-Kahf', 'Ramadan', 'Forgiveness'].map((topic) => {
                const active = selectedTopic === topic;
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setSelectedTopic(topic)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: active ? '1px solid #1E563B' : '1px solid #E2E8F0',
                      background: active ? '#E8F5EE' : '#FFFFFF',
                      color: active ? '#1E563B' : '#475569',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Surah & Ayah Selector Row */}
          <div style={{ padding: '0 20px', marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8 }}>
              <div
                className="iq-white-card"
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>Surah</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    18 · Al-Kahf
                  </div>
                </div>
                <PhIcon name="caret-down" weight="bold" size={12} color="#64748B" />
              </div>

              <div
                className="iq-white-card"
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>Ayah</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    Ayah 10 / 110
                  </div>
                </div>
                <PhIcon name="caret-down" weight="bold" size={12} color="#64748B" />
              </div>
            </div>
          </div>

          {/* Live Ayah Preview Card (Uthmani Arabic + Urdu Nastaliq + English) */}
          <div style={{ padding: '0 20px', flex: 1 }}>
            <div className="iq-white-card" style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1E563B' }}>
                  Surah Al-Kahf : 10
                </span>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                  Dua of the Youths of the Cave
                </span>
              </div>

              <div className="iq-arabic-display" style={{ fontSize: 19, margin: '10px 0' }}>
                رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا{' '}
                <AyahMedallion number={10} size={26} />
              </div>

              <div
                dir="rtl"
                lang="ur"
                style={{
                  fontFamily: 'var(--font-urdu)',
                  fontSize: 13.5,
                  lineHeight: 2.0,
                  color: '#1E293B',
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                اے ہمارے رب! ہمیں اپنے پاس سے رحمت عطا فرما اور ہمارے کام میں ہمارے لیے راہِ راست
                مہیا فرما۔
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  color: '#64748B',
                  textAlign: 'center',
                  lineHeight: 1.45,
                  paddingTop: 8,
                  borderTop: '1px solid #F1F5F9',
                }}
              >
                &ldquo;Our Lord, grant us from Yourself mercy and prepare for us from our affair
                right guidance.&rdquo;
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px 0', marginTop: 'auto' }}>
            <button type="button" className="iq-pill-cta dark">
              <span>Publish to Masjid Followers →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
