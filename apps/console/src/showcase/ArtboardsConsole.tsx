import React, { useState } from 'react';
import { PhIcon, AyahMedallion } from './icons';

type NavItemKey =
  | 'venues'
  | 'sessions'
  | 'coordinators'
  | 'registrations'
  | 'daily-ayahs'
  | 'posters'
  | 'import'
  | 'exports'
  | 'audit'
  | 'settings';

interface ConsoleNavEntry {
  key: NavItemKey;
  label: string;
  icon: string;
  badge?: string;
}

const CONSOLE_NAV_ITEMS: ConsoleNavEntry[] = [
  { key: 'venues', label: 'Venues & Masjids', icon: 'mosque', badge: '48' },
  { key: 'sessions', label: 'Circles & Sessions', icon: 'calendar-blank', badge: '112' },
  { key: 'coordinators', label: 'Coordinators', icon: 'users-three', badge: '64' },
  { key: 'registrations', label: 'Registrations', icon: 'ticket', badge: '1.8k' },
  { key: 'daily-ayahs', label: 'Daily Ayahs', icon: 'book-open-text' },
  { key: 'posters', label: 'QR Posters', icon: 'qr-code', badge: 'PDF' },
  { key: 'import', label: 'CSV Import', icon: 'file-csv' },
  { key: 'exports', label: 'Exports', icon: 'download-simple' },
  { key: 'audit', label: 'Audit Log', icon: 'shield-check' },
  { key: 'settings', label: 'Settings', icon: 'sliders-horizontal' },
];

const CITIES = ['All Cities', 'Lahore', 'Islamabad', 'Karachi'] as const;

function ConsoleShell({
  activeNav,
  searchPlaceholder,
  children,
}: {
  activeNav: NavItemKey;
  searchPlaceholder: string;
  children: React.ReactNode;
}) {
  const [selectedCity, setSelectedCity] = useState<string>('All Cities');

  return (
    <div
      style={{
        width: 1140,
        minHeight: 720,
        borderRadius: 24,
        background: '#F8FAFC',
        overflow: 'hidden',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        color: '#111827',
      }}
    >
      {/* Unified Quran Circles Operations Console Left Sidebar */}
      <aside
        style={{
          width: 220,
          background: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {/* Deep Emerald Brand Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #153D29 0%, #1E563B 100%)',
              padding: '18px 16px',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.14)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PhIcon name="mosque" weight="duotone" size={19} color="#A7F3D0" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em' }}>
                Quran Circles
              </div>
              <div style={{ fontSize: 10.5, color: '#A7F3D0', fontWeight: 600, marginTop: 1 }}>
                @qc/console · Web Ops
              </div>
            </div>
          </div>

          {/* Season Mode Banner Pill */}
          <div
            style={{
              margin: '12px 12px 6px',
              padding: '7px 10px',
              borderRadius: 10,
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              fontWeight: 700,
              color: '#92400E',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <PhIcon name="moon-stars" weight="fill" size={13} color="#D97706" />
              <span>Season: Circles</span>
            </span>
            <span style={{ fontSize: 10, color: '#B45309', fontWeight: 600 }}>Hijri 0d</span>
          </div>

          {/* Navigation Items */}
          <nav style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CONSOLE_NAV_ITEMS.map((item) => {
              const isActive = item.key === activeNav;
              return (
                <div
                  key={item.key}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: isActive ? '#E8F5EE' : 'transparent',
                    color: isActive ? '#153D29' : '#475569',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <PhIcon
                      name={item.icon}
                      weight={isActive ? 'fill' : 'duotone'}
                      size={16}
                      color={isActive ? '#1E563B' : '#64748B'}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: isActive ? '#1E563B' : '#F1F5F9',
                        color: isActive ? '#FFFFFF' : '#64748B',
                      }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Operator Scope Footer */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid #F1F5F9',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10B981',
                display: 'inline-block',
              }}
            />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>National Scope</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>EN / اردو · PKT (UTC+5)</div>
            </div>
          </div>
          <PhIcon name="translate" weight="bold" size={14} color="#64748B" />
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Clean Top Header Bar */}
        <header
          style={{
            height: 60,
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* City Filter Segmented Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748B',
                marginRight: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <PhIcon name="map-pin" weight="duotone" size={14} color="#1E563B" />
              <span>City:</span>
            </span>
            <div
              style={{
                display: 'inline-flex',
                background: '#F1F5F9',
                padding: 3,
                borderRadius: 999,
                gap: 2,
              }}
            >
              {CITIES.map((city) => {
                const active = selectedCity === city;
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSelectedCity(city)}
                    style={{
                      border: 'none',
                      background: active ? '#FFFFFF' : 'transparent',
                      color: active ? '#111827' : '#64748B',
                      fontSize: 11.5,
                      fontWeight: active ? 700 : 600,
                      padding: '4px 11px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                    }}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Bar & Operator Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 240,
                height: 34,
                borderRadius: 999,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 11.5,
                color: '#64748B',
              }}
            >
              <PhIcon name="magnifying-glass" size={14} color="#94A3B8" />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {searchPlaceholder}
              </span>
            </div>

            <div
              style={{
                height: 34,
                padding: '0 12px 0 6px',
                borderRadius: 999,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#1E563B',
                  color: '#FFFFFF',
                  fontSize: 10.5,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                TO
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#065F46' }}>
                Admin · Tanzeem Operations
              </span>
            </div>
          </div>
        </header>

        {/* Body */}
        <div style={{ padding: '18px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SeatMeterCell({ taken, capacity }: { taken: number; capacity: number }) {
  const pct = Math.min(100, Math.round((taken / capacity) * 100));
  const isNearFull = pct >= 85;
  return (
    <div style={{ minWidth: 92 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontWeight: 700,
          color: isNearFull ? '#B45309' : '#111827',
          marginBottom: 4,
        }}
      >
        <span>
          {taken} / {capacity}
        </span>
        <span style={{ color: '#64748B', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: '#E2E8F0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: isNearFull ? '#F59E0B' : '#1E563B',
          }}
        />
      </div>
    </div>
  );
}

export function ArtboardsConsole() {
  const [selectedSessionIdx, setSelectedSessionIdx] = useState(0);

  const sessionsRows = [
    {
      id: 'ses-101',
      masjid: 'Jamia Masjid Al-Noor',
      area: 'DHA Phase 4 · Lahore',
      program: 'Weekly Halqa',
      schedule: 'Fri · After Maghrib 7:30 PM',
      portion: 'Al-Kahf : 1–31',
      section: 'Brothers',
      taken: 18,
      capacity: 40,
      coordinator: 'Ustadh Ahmad Raza',
      coordStatus: 'Checked In',
      status: 'Published',
      facilities: ['Wudu', 'Parking', 'AC Hall', 'Sisters Area'],
      phone: '+92 300 4129810',
    },
    {
      id: 'ses-102',
      masjid: 'Markazi Masjid Bilal',
      area: 'Gulberg III · Lahore',
      program: 'Ramadan Dora-e-Quran',
      schedule: 'Daily · After Tarawih 9:15 PM',
      portion: 'Al-Baqarah : 142–202',
      section: 'Families',
      taken: 54,
      capacity: 60,
      coordinator: 'Qari Salman Tariq',
      coordStatus: 'Checked In',
      status: 'Published',
      facilities: ['Wudu', 'Wheelchair', 'Sisters Area'],
      phone: '+92 321 8441920',
    },
    {
      id: 'ses-103',
      masjid: 'Faisal Mosque Islamic Centre',
      area: 'Sector E-8 · Islamabad',
      program: 'Weekly Halqa',
      schedule: 'Sat · After Asr 4:45 PM',
      portion: 'Yaseen : 1–40',
      section: 'Sisters',
      taken: 32,
      capacity: 45,
      coordinator: 'Ustadha Maryam Siddiqi',
      coordStatus: 'Verified',
      status: 'Published',
      facilities: ['Sisters Hall', 'Wudu', 'Parking'],
      phone: '+92 333 5109281',
    },
    {
      id: 'ses-104',
      masjid: 'Masjid Bait-ul-Mukarram',
      area: 'Gulshan-e-Iqbal · Karachi',
      program: 'Ramadan Dora-e-Quran',
      schedule: 'Fri · After Isha 8:45 PM',
      portion: 'Ar-Rahman : 1–78',
      section: 'Brothers',
      taken: 29,
      capacity: 50,
      coordinator: 'Hafiz Zubair Usmani',
      coordStatus: 'Awaiting Approval',
      status: 'Draft',
      facilities: ['Wudu', 'Parking', 'AC Hall'],
      phone: '+92 345 2190844',
    },
  ];

  const activeSession = sessionsRows[selectedSessionIdx] ?? sessionsRows[0]!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36, paddingBottom: 40 }}>
      {/* ======================================================================
          DESKTOP ARTBOARD 01: VENUES & CIRCLE SESSIONS MANAGEMENT
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption" style={{ width: 1140 }}>
          <span>01. Console — Venues & Circle Sessions Management (`VenuesPage` + `SessionsPage`)</span>
          <span>1140 × 720 · Desktop Web App</span>
        </div>

        <ConsoleShell
          activeNav="sessions"
          searchPlaceholder="Search masjids, surah portions, teachers..."
        >
          {/* Top 4 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              {
                label: 'Active Masjids',
                value: '48 Active Masjids',
                sub: '36 with Sisters Section · 3 Cities',
                icon: 'mosque',
                tone: '#1E563B',
                bg: '#E8F5EE',
              },
              {
                label: 'Weekly & Dora Circles',
                value: '112 Weekly Circles',
                sub: '84 Weekly Halqa · 28 Ramadan Dora',
                icon: 'calendar-blank',
                tone: '#0284C7',
                bg: '#E0F2FE',
              },
              {
                label: 'Live Attendance Demand',
                value: '1,840 Seats Reserved Tonight',
                sub: '+214 via SMS OTP in last 2 hours',
                icon: 'ticket',
                tone: '#D97706',
                bg: '#FEF3C7',
              },
              {
                label: 'Field Reliability',
                value: '94% Coordinator Check-In',
                sub: '45 of 48 Masjids verified tonight',
                icon: 'check-circle',
                tone: '#059669',
                bg: '#D1FAE5',
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  border: '1px solid #E2E8F0',
                  padding: '13px 15px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{kpi.label}</div>
                  <div
                    style={{
                      fontSize: 15.5,
                      fontWeight: 800,
                      color: '#111827',
                      marginTop: 4,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 3 }}>{kpi.sub}</div>
                </div>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: kpi.bg,
                    color: kpi.tone,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PhIcon name={kpi.icon} weight="duotone" size={18} />
                </div>
              </div>
            ))}
          </div>

          {/* Main Split Workspace: Left Table + Right Quick Session/Venue Inspector Drawer */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 295px',
              gap: 14,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Left: Masjids & Circle Sessions Table Card */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
              }}
            >
              {/* Sub-header with Tabs & Action */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      background: '#111827',
                      color: '#FFFFFF',
                      fontSize: 11.5,
                      fontWeight: 700,
                    }}
                  >
                    Circle Sessions (112)
                  </span>
                  <span
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      background: '#F1F5F9',
                      color: '#475569',
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    Masjids & Venues (48)
                  </span>
                  <span
                    style={{
                      padding: '4px 9px',
                      borderRadius: 999,
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontSize: 10.5,
                      fontWeight: 700,
                    }}
                  >
                    2 Awaiting Approval
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 999,
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#334155',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <PhIcon name="file-csv" weight="duotone" size={14} color="#1E563B" />
                    <span>+ Bulk Import CSV</span>
                  </button>
                </div>
              </div>

              {/* Sessions & Venues Table */}
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        background: '#F8FAFC',
                        borderBottom: '1px solid #E2E8F0',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th style={{ padding: '9px 14px' }}>Masjid & Neighbourhood</th>
                      <th style={{ padding: '9px 10px' }}>Program & Schedule</th>
                      <th style={{ padding: '9px 10px' }}>Tonight’s Portion</th>
                      <th style={{ padding: '9px 10px' }}>Section</th>
                      <th style={{ padding: '9px 10px' }}>Live SeatMeter</th>
                      <th style={{ padding: '9px 12px' }}>Coordinator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsRows.map((row, idx) => {
                      const selected = idx === selectedSessionIdx;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedSessionIdx(idx)}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            background: selected ? '#F0FDF4' : '#FFFFFF',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>
                              {row.masjid}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                              {row.area}
                            </div>
                          </td>
                          <td style={{ padding: '11px 10px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background:
                                  row.program === 'Weekly Halqa' ? '#E8F5EE' : '#FEF3C7',
                                color: row.program === 'Weekly Halqa' ? '#1E563B' : '#92400E',
                                marginBottom: 3,
                              }}
                            >
                              {row.program}
                            </span>
                            <div style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>
                              {row.schedule}
                            </div>
                          </td>
                          <td style={{ padding: '11px 10px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '4px 9px',
                                borderRadius: 999,
                                background: '#FFFBEB',
                                border: '1px solid #FDE68A',
                                color: '#92400E',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              <PhIcon name="book-open-text" weight="fill" size={12} color="#D97706" />
                              <span>{row.portion}</span>
                            </span>
                          </td>
                          <td style={{ padding: '11px 10px' }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 999,
                                background:
                                  row.section === 'Sisters'
                                    ? '#FDF2F8'
                                    : row.section === 'Families'
                                      ? '#EFF6FF'
                                      : '#F1F5F9',
                                color:
                                  row.section === 'Sisters'
                                    ? '#9D174D'
                                    : row.section === 'Families'
                                      ? '#1E40AF'
                                      : '#334155',
                              }}
                            >
                              {row.section}
                            </span>
                          </td>
                          <td style={{ padding: '11px 10px' }}>
                            <SeatMeterCell taken={row.taken} capacity={row.capacity} />
                          </td>
                          <td style={{ padding: '11px 12px' }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>
                              {row.coordinator}
                            </div>
                            <div
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                color:
                                  row.coordStatus === 'Awaiting Approval' ? '#D97706' : '#059669',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 2,
                              }}
                            >
                              <PhIcon
                                name={
                                  row.coordStatus === 'Awaiting Approval'
                                    ? 'warning-circle'
                                    : 'check-circle'
                                }
                                weight="fill"
                                size={12}
                              />
                              <span>{row.coordStatus}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Summary */}
              <div
                style={{
                  padding: '10px 16px',
                  background: '#F8FAFC',
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: '#64748B',
                }}
              >
                <span>Showing 4 of 112 active circle sessions in scope</span>
                <span style={{ fontWeight: 700, color: '#1E563B' }}>
                  Click any row to inspect Masjid & Session →
                </span>
              </div>
            </div>

            {/* Right-Side Quick Session / Venue Inspector Drawer */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#1E563B',
                    }}
                  >
                    Quick Session & Venue Inspector
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#D1FAE5',
                      color: '#065F46',
                    }}
                  >
                    {activeSession.status}
                  </span>
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                  {activeSession.masjid}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                  {activeSession.area} · {activeSession.phone}
                </div>

                {/* Editable Portion & Schedule Box */}
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>
                      Tonight’s Assigned Surah Portion
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{activeSession.portion}</span>
                      <PhIcon name="pencil-simple" size={13} color="#64748B" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>
                        Section
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          padding: '5px 8px',
                          borderRadius: 8,
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        {activeSession.section}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>
                        Seat Cap
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          padding: '5px 8px',
                          borderRadius: 8,
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        {activeSession.taken} / {activeSession.capacity} seats
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verified Masjid Facilities */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Verified Masjid Facilities
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {activeSession.facilities.map((fac) => (
                      <span
                        key={fac}
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: '#F1F5F9',
                          color: '#334155',
                        }}
                      >
                        ✓ {fac}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drawer Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
                <button
                  type="button"
                  className="iq-pill-cta dark"
                  style={{ height: 36, fontSize: 12 }}
                >
                  <PhIcon name="check-circle" weight="fill" size={14} color="#6EE7B7" />
                  <span>Save & Publish Circle Update</span>
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button type="button" className="iq-pill-cta" style={{ height: 32, fontSize: 11 }}>
                    <PhIcon name="ticket" size={13} />
                    <span>Registrations</span>
                  </button>
                  <button type="button" className="iq-pill-cta" style={{ height: 32, fontSize: 11 }}>
                    <PhIcon name="qr-code" size={13} />
                    <span>A4 QR Poster</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ConsoleShell>
      </div>

      {/* ======================================================================
          DESKTOP ARTBOARD 02: COORDINATORS, REGISTRATIONS & DAILY AYAH CURATION
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption" style={{ width: 1140 }}>
          <span>
            02. Console — Coordinators, Registrations & Daily Ayah Curation (`CoordinatorsPage` + `DailyAyahsPage` + `RegistrationsPage`)
          </span>
          <span>1140 × 720 · Desktop Web App</span>
        </div>

        <ConsoleShell
          activeNav="coordinators"
          searchPlaceholder="Search coordinator phone (+92), masjid scope, invite..."
        >
          {/* Top Row: Coordinators & Working Scopes Table + Assign Coordinator Scope Card */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14 }}>
            {/* Left: Coordinators & Working Scopes (`CoordinatorsPage`) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div
                style={{
                  padding: '11px 16px',
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
                    Field Coordinators & Working Scopes
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>
                    64 Active Role Assignments · 5 Pending SMS Invites (24h limit: 20/day)
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#E8F5EE',
                    color: '#1E563B',
                  }}
                >
                  RBAC Scoped
                </span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr
                    style={{
                      background: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0',
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#64748B',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '8px 14px' }}>Coordinator</th>
                    <th style={{ padding: '8px 10px' }}>Phone (OTP Verified)</th>
                    <th style={{ padding: '8px 10px' }}>Assigned Masjid / City Scope</th>
                    <th style={{ padding: '8px 10px' }}>Role Badge</th>
                    <th style={{ padding: '8px 12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      name: 'Ustadh Ahmad Raza',
                      phone: '+92 300 4129810',
                      scope: 'Jamia Masjid Al-Noor (Lahore)',
                      role: 'Venue Coordinator',
                      tone: '#1E563B',
                      bg: '#E8F5EE',
                    },
                    {
                      name: 'Dr. Tariq Mehmood',
                      phone: '+92 321 9001122',
                      scope: 'DHA Phase 4 Masjid & Lahore City',
                      role: 'City Coordinator',
                      tone: '#1D4ED8',
                      bg: '#DBEAFE',
                    },
                    {
                      name: 'Ustadha Maryam Siddiqi',
                      phone: '+92 333 5109281',
                      scope: 'Faisal Mosque Islamic Centre',
                      role: 'Venue Coordinator',
                      tone: '#1E563B',
                      bg: '#E8F5EE',
                    },
                    {
                      name: 'Hafiz Usman Ghani',
                      phone: '+92 345 ••••841',
                      scope: 'Markazi Masjid Bilal (Handover)',
                      role: 'Invite Pending',
                      tone: '#B45309',
                      bg: '#FEF3C7',
                    },
                  ].map((c) => (
                    <tr key={c.phone} style={{ borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                      <td style={{ padding: '9px 14px', fontWeight: 700, color: '#111827' }}>
                        {c.name}
                      </td>
                      <td
                        style={{
                          padding: '9px 10px',
                          fontFamily: 'monospace',
                          fontSize: 11.5,
                          color: '#334155',
                        }}
                      >
                        {c.phone}
                      </td>
                      <td style={{ padding: '9px 10px', color: '#334155', fontWeight: 600 }}>
                        {c.scope}
                      </td>
                      <td style={{ padding: '9px 10px' }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: c.bg,
                            color: c.tone,
                          }}
                        >
                          {c.role}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#1E563B',
                            cursor: 'pointer',
                          }}
                        >
                          Handover · Revoke
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right: + Assign Coordinator Scope Modal / Side Card */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                padding: '13px 15px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                    + Assign Coordinator Scope
                  </span>
                  <PhIcon name="shield-check" weight="duotone" size={17} color="#1E563B" />
                </div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Sends SMS OTP invite or atomic role handover
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>
                      Role & Working Scope
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#111827',
                      }}
                    >
                      Venue Coordinator · DHA Phase 4 Masjid
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>
                        Mobile (PK E.164)
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                          fontSize: 11,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        +92 302 7811409
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>
                        Coordinator Name
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Qari Bilal Hassan
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="iq-pill-cta dark"
                style={{ height: 34, fontSize: 11.5, marginTop: 10 }}
              >
                <PhIcon name="paper-plane-tilt" weight="fill" size={13} color="#6EE7B7" />
                <span>Send Scoped SMS Invite</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Daily Ayahs Curation (`DailyAyahsPage`) + Live Registrations (`RegistrationsPage`) */}
          <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: 14, flex: 1 }}>
            {/* Daily Ayahs Curation Card with Uthmani Arabic + Urdu Nastaliq Preview */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#111827' }}>
                      Daily Ayah Curation (`DailyAyahsPage`)
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      30-Day Pakistan Schedule · National, Venue & Circle Picks
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: '#FEF3C7',
                      color: '#92400E',
                    }}
                  >
                    0 Fallback Gaps
                  </span>
                </div>

                {/* Curated Verse Preview Box with Uthmani Arabic + Urdu Nastaliq */}
                <div
                  style={{
                    marginTop: 10,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'linear-gradient(180deg, #F3FBF7 0%, #FFFFFF 100%)',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#1E563B',
                      marginBottom: 6,
                    }}
                  >
                    <span>Tonight’s Pick · Surah Al-Kahf (18:28)</span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: '#1E563B',
                        color: '#FFFFFF',
                        fontSize: 10,
                      }}
                    >
                      National + Lahore
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--font-quran)',
                      fontSize: 19,
                      lineHeight: 1.75,
                      color: '#111827',
                      direction: 'rtl',
                      textAlign: 'right',
                    }}
                  >
                    وَٱصْبِرْ نَفْسَكَ مَعَ ٱلَّذِينَ يَدْعُونَ رَبَّهُم بِٱلْغَدَوٰةِ وَٱلْعَشِىِّ
                    <AyahMedallion number={28} size={24} />
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--font-urdu)',
                      fontSize: 13,
                      lineHeight: 1.9,
                      color: '#334155',
                      direction: 'rtl',
                      textAlign: 'right',
                      marginTop: 4,
                    }}
                  >
                    اور اپنے آپ کو ان لوگوں کے ساتھ روکے رکھو جو صبح و شام اپنے رب کو پکارتے ہیں
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: '#64748B',
                }}
              >
                <span>Next 3 days: 18:10 (Sat) · 2:255 (Sun) · 36:12 (Mon)</span>
                <span style={{ fontWeight: 700, color: '#1E563B', cursor: 'pointer' }}>
                  + Schedule Pick →
                </span>
              </div>
            </div>

            {/* Right: Live Registrations & Audited CSV Export (`RegistrationsPage` + `ExportsPage`) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#111827' }}>
                      Live Seat Registrations (`RegistrationsPage`)
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Jamia Masjid Al-Noor · 28 Confirmed · 4 Waitlisted · Exports Audited
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 999,
                      background: '#111827',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <PhIcon name="download-simple" weight="bold" size={13} color="#6EE7B7" />
                    <span>Export UTF-8 CSV (Audited)</span>
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        background: '#F8FAFC',
                        borderBottom: '1px solid #E2E8F0',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#64748B',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '6px 8px' }}>Attendee</th>
                      <th style={{ padding: '6px 8px' }}>Phone</th>
                      <th style={{ padding: '6px 8px' }}>Section · Party</th>
                      <th style={{ padding: '6px 8px' }}>WhatsApp</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        name: 'Hamza Tariq',
                        phone: '+92 301 4882910',
                        sec: 'Brothers · 2 seats',
                        wa: 'Opted In',
                        status: 'Confirmed',
                      },
                      {
                        name: 'Ayesha Siddiqua',
                        phone: '+92 332 7190024',
                        sec: 'Sisters · 3 seats',
                        wa: 'Opted In',
                        status: 'Confirmed',
                      },
                      {
                        name: 'Saad Bin Zafar',
                        phone: '+92 321 6510982',
                        sec: 'Families · 4 seats',
                        wa: 'SMS Only',
                        status: 'Waitlisted',
                      },
                    ].map((r) => (
                      <tr key={r.phone} style={{ borderBottom: '1px solid #F1F5F9', fontSize: 11.5 }}>
                        <td style={{ padding: '7px 8px', fontWeight: 700 }}>{r.name}</td>
                        <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                          {r.phone}
                        </td>
                        <td style={{ padding: '7px 8px', color: '#475569' }}>{r.sec}</td>
                        <td style={{ padding: '7px 8px', color: '#059669', fontWeight: 600 }}>
                          {r.wa}
                        </td>
                        <td style={{ padding: '7px 8px' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 999,
                              background: r.status === 'Confirmed' ? '#D1FAE5' : '#FEF3C7',
                              color: r.status === 'Confirmed' ? '#065F46' : '#92400E',
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 8 }}>
                🔒 Personal numbers visible only to scoped Masjid/City coordinators; every CSV export writes an immutable audit entry.
              </div>
            </div>
          </div>
        </ConsoleShell>
      </div>

      {/* ======================================================================
          DESKTOP ARTBOARD 03: CSV BULK IMPORT, BATCH QR POSTERS & AUDIT TRAIL
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption" style={{ width: 1140 }}>
          <span>
            03. Console — CSV Bulk Import, Batch QR Posters & Audit Trail (`ImportPage` + `PostersPage` + `AuditPage`)
          </span>
          <span>1140 × 720 · Desktop Web App</span>
        </div>

        <ConsoleShell
          activeNav="import"
          searchPlaceholder="Search dry-run rows, poster templates, audit actor..."
        >
          {/* Top Section: CSV Bulk Import Validator (`ImportPage`) */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 18,
              border: '1px solid #E2E8F0',
              padding: '14px 18px',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: '#E8F5EE',
                    color: '#1E563B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PhIcon name="file-csv" weight="duotone" size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: '#111827' }}>
                      CSV Bulk Import Validator (`ImportPage` · Server Dry-Run Passed)
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 9px',
                        borderRadius: 999,
                        background: '#F1F5F9',
                        color: '#334155',
                        fontFamily: 'monospace',
                      }}
                    >
                      lahore-ramadan-dora-2026.csv
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    All-or-nothing atomic commit · Checked in browser & verified against server scope
                  </div>
                </div>
              </div>

              {/* Summary Pills & Commit CTA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: '#D1FAE5',
                    color: '#065F46',
                  }}
                >
                  ✓ 24 Valid Rows
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: '#FEF3C7',
                    color: '#92400E',
                  }}
                >
                  1 Warning (Duplicate Skipped)
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  0 Errors
                </span>
                <button
                  type="button"
                  className="iq-pill-cta dark"
                  style={{ width: 'auto', height: 34, padding: '0 16px', fontSize: 12 }}
                >
                  <span>Commit 24 Sessions →</span>
                </button>
              </div>
            </div>

            {/* Row-by-row Validation Preview Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                  }}
                >
                  <th style={{ padding: '6px 10px' }}>CSV Line</th>
                  <th style={{ padding: '6px 10px' }}>Masjid & Session Title (EN / UR)</th>
                  <th style={{ padding: '6px 10px' }}>Schedule & Section</th>
                  <th style={{ padding: '6px 10px' }}>Dry-Run Status</th>
                  <th style={{ padding: '6px 10px' }}>Validation Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    line: 'Line 02',
                    title: 'Jamia Masjid Al-Noor — Dora-e-Quran Juz 1–30 (دورہ قرآن)',
                    sched: 'Daily 21:15 · Brothers · Cap 60',
                    status: 'Valid',
                    note: 'Venue ID matched · Teacher Qari Ahmad verified',
                  },
                  {
                    line: 'Line 03',
                    title: 'DHA Phase 4 Masjid — Sisters Tafseer Al-Kahf',
                    sched: 'Fri 16:30 · Sisters · Cap 45',
                    status: 'Valid',
                    note: 'Bilingual title & E.164 phone validated',
                  },
                  {
                    line: 'Line 04',
                    title: 'Markazi Masjid Bilal — Weekly Youth Halqa',
                    sched: 'Sat 19:45 · Brothers · Cap 40',
                    status: 'Duplicate',
                    note: 'Warning: Session already exists for this venue & time; will be skipped safely',
                  },
                ].map((r) => (
                  <tr key={r.line} style={{ borderBottom: '1px solid #F1F5F9', fontSize: 11.5 }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700 }}>
                      {r.line}
                    </td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#111827' }}>
                      {r.title}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#475569' }}>{r.sched}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: r.status === 'Valid' ? '#059669' : '#D97706',
                        }}
                      >
                        <PhIcon
                          name={r.status === 'Valid' ? 'check-circle' : 'warning-circle'}
                          weight="fill"
                          size={13}
                        />
                        <span>{r.status}</span>
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: '#64748B', fontSize: 11 }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom 2-Column Section: Batch QR Poster Generator (`PostersPage`) + Immutable Audit Log (`AuditPage`) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1 }}>
            {/* Left: Batch QR Poster Generator (`PostersPage`) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#111827' }}>
                      Batch QR Poster Generator (`PostersPage`)
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Print A4/A3 PDF & WhatsApp PNG · Auto-detects schedule drift
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      height: 30,
                      padding: '0 11px',
                      borderRadius: 999,
                      background: '#1E563B',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <PhIcon name="file-pdf" weight="fill" size={13} />
                    <span>Download Bulk A4 PDFs</span>
                  </button>
                </div>

                {/* Miniature Masjid A4 QR Standee Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    {
                      masjid: 'Masjid Al-Noor',
                      title: 'Surah Al-Kahf Halqa',
                      format: 'Print A4 · Bilingual',
                      status: 'Ready PDF',
                      accent: '#153D29',
                    },
                    {
                      masjid: 'Masjid Bilal',
                      title: 'Ramadan Dora-e-Quran',
                      format: 'Print A3 · Urdu',
                      status: 'Ready PDF',
                      accent: '#1E563B',
                    },
                    {
                      masjid: 'Faisal Mosque',
                      title: 'Sisters Tafseer Circle',
                      format: 'WhatsApp Story PNG',
                      status: 'Time Changed · Regen',
                      accent: '#92400E',
                    },
                  ].map((p) => (
                    <div
                      key={p.masjid}
                      style={{
                        borderRadius: 12,
                        border: '1px solid #E2E8F0',
                        overflow: 'hidden',
                        background: '#F8FAFC',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        style={{
                          background: p.accent,
                          color: '#FFFFFF',
                          padding: '8px 9px',
                          fontSize: 10.5,
                          fontWeight: 800,
                        }}
                      >
                        <div>{p.masjid}</div>
                        <div style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 600 }}>
                          {p.title}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '8px 9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#334155' }}>
                            {p.format}
                          </div>
                          <div
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              color: p.status.includes('Regen') ? '#D97706' : '#059669',
                              marginTop: 2,
                            }}
                          >
                            ● {p.status}
                          </div>
                        </div>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <PhIcon name="qr-code" weight="bold" size={18} color="#111827" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 8 }}>
                QR Target: Direct Session Registration Pass · Templates: Tanzeem Emerald & Classic Parchment
              </div>
            </div>

            {/* Right: Immutable Audit Log (`AuditPage`) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#111827' }}>
                      Immutable Audit Log (`AuditPage`)
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Scoped record of every coordinator, import, export & admin action
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: '#F1F5F9',
                      color: '#334155',
                    }}
                  >
                    PKT (UTC+5)
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    {
                      time: '19:14 PKT',
                      actor: 'Ustadh Ahmad updated portion to Al-Kahf 1–31',
                      code: 'session.portion_updated · ses_101',
                      scope: 'Jamia Masjid Al-Noor',
                    },
                    {
                      time: '18:52 PKT',
                      actor: 'Admin approved Jamia Masjid Bilal',
                      code: 'venue.status_active · ven_204',
                      scope: 'Lahore City',
                    },
                    {
                      time: '18:30 PKT',
                      actor: 'Dr. Tariq exported 54 session registrations CSV',
                      code: 'registration.export · ses_102',
                      scope: 'Markazi Masjid Bilal',
                    },
                    {
                      time: '17:45 PKT',
                      actor: 'Tanzeem Ops committed 24 sessions via CSV dry-run',
                      code: 'import.sessions_commit · batch_88',
                      scope: 'National Scope',
                    },
                  ].map((log) => (
                    <div
                      key={log.code}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 10,
                        background: '#F8FAFC',
                        border: '1px solid #F1F5F9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>
                          {log.actor}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: 'monospace',
                            color: '#1E563B',
                            marginTop: 1,
                          }}
                        >
                          {log.code} · {log.scope}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#64748B',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 8 }}>
                Zero PII stored in audit log rows · Filterable by City, Masjid, Entity Type & PKT Date Range
              </div>
            </div>
          </div>
        </ConsoleShell>
      </div>
    </div>
  );
}
