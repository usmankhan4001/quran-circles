import React from 'react';
import { PhIcon } from './icons';

export function ArtboardsSession({
  onNavigatePage,
}: {
  onNavigatePage: (page: string) => void;
}) {
  return (
    <div className="artboard-row">
      {/* ======================================================================
          ARTBOARD 01: SESSIONSCREEN (CIRCLE DETAIL)
          Inspired by Iqraa Screenshot 1 Right Phone (Hero Photo + Clean White Sheet)
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>01. SessionScreen — Circle Detail & Portions</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingBottom: 84 }}>
          {/* Hero Photo Header */}
          <div style={{ position: 'relative', height: 215, overflow: 'hidden' }}>
            <img
              src="https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=800&q=80"
              alt="Jamia Masjid Al-Noor"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 45%, rgba(10,28,20,0.88) 100%)',
                padding: '14px 20px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#FFFFFF',
              }}
            >
              <div>
                <div className="iq-status-row" style={{ marginBottom: 10 }}>
                  <span>9:41</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <PhIcon name="cell-signal-full" weight="bold" size={13} />
                    <PhIcon name="wifi-high" weight="bold" size={13} />
                    <PhIcon name="battery-full" weight="fill" size={15} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onNavigatePage('home')}
                    style={{
                      border: 'none',
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                    }}
                  >
                    <PhIcon name="caret-left" weight="bold" size={13} />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <PhIcon name="share-network" weight="regular" size={15} />
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(6px)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Brothers · Urdu/Eng
                  </span>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)' }}>
                    Every Thursday · 45 mins
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Tafseer Surah Al-Kahf
                </div>
              </div>
            </div>
          </div>

          {/* Clean White Sheet Content */}
          <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Venue & Ustadh Card */}
            <div className="iq-white-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    }}
                  >
                    <PhIcon name="mosque" weight="duotone" size={19} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                      Jamia Masjid Al-Noor
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                      Main Blvd, Gulberg III · 0.8 km
                    </div>
                  </div>
                </div>
                <PhIcon name="caret-right" weight="bold" size={14} color="#94A3B8" />
              </div>

              <div style={{ height: 1, background: '#F1F5F9' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#FEF3C7',
                      color: '#B45309',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    UA
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                      Ustadh Ahmad Al-Azhari
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                      In-person + Online livestream
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E563B' }}>Online ↗</span>
              </div>
            </div>

            {/* SeatMeter Capacity */}
            <div className="iq-white-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: '#111827' }}>22 seats available tonight</span>
                <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>18 / 40 reserved</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
                <div style={{ width: '45%', height: '100%', borderRadius: 999, background: '#10B981' }} />
              </div>
            </div>

            {/* Upcoming Occurrences & Portions */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                Upcoming Schedule & Portions
              </div>
              <div className="iq-white-card" style={{ padding: '6px 14px' }}>
                {[
                  { d: 'Tonight · 7:30 PM', p: 'Al-Kahf : 1–31' },
                  { d: 'Thu, 25 Oct · 7:30 PM', p: 'Al-Kahf : 32–59' },
                  { d: 'Thu, 1 Nov · 7:30 PM', p: 'Al-Kahf : 60–82' },
                ].map((occ, i) => (
                  <div
                    key={occ.d}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: i < 2 ? '1px solid #F8FAFC' : 'none',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#334155' }}>{occ.d}</span>
                    <span style={{ fontWeight: 700, color: '#B45309', background: '#FFFBEB', padding: '3px 8px', borderRadius: 999, fontSize: 11 }}>
                      {occ.p}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Facilities Row */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {[
                { ic: 'drop', l: 'Wudu Area' },
                { ic: 'car-profile', l: 'Parking' },
                { ic: 'wheelchair', l: 'Step-Free' },
                { ic: 'wind', l: 'A/C Hall' },
              ].map((f) => (
                <span
                  key={f.l}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 999,
                    background: '#F8FAFC',
                    border: '1px solid #F1F5F9',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <PhIcon name={f.ic} weight="duotone" size={14} color="#1E563B" />
                  {f.l}
                </span>
              ))}
            </div>
          </div>

          {/* Sticky Dark Pill Bottom CTA (Iqraa Screenshot 1 Left Phone Style) */}
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: 20,
              right: 20,
            }}
          >
            <button type="button" className="iq-pill-cta dark">
              <PhIcon name="ticket" weight="fill" size={16} />
              <span>Reserve Free Seat (Tonight 7:30 PM)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 02: REGISTRATIONSCREEN (SEAT STEPPER + PHONE + OTP)
          Matches Iqraa Screenshot 3 Left "Sign Up" Clean Input Form
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>02. RegistrationScreen — Seats & OTP Verification</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ padding: '14px 20px 28px' }}>
          <div className="iq-status-row" style={{ color: '#111827', marginBottom: 14 }}>
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PhIcon name="cell-signal-full" weight="bold" size={13} />
              <PhIcon name="wifi-high" weight="bold" size={13} />
              <PhIcon name="battery-full" weight="fill" size={15} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <PhIcon name="caret-left" weight="bold" size={14} /> Back
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>Reserve Seat</span>
            <span style={{ width: 40 }} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            Reserve your place for tonight&apos;s circle
          </div>
          <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 6, marginBottom: 24 }}>
            Tafseer Surah Al-Kahf · Jamia Masjid Al-Noor · 7:30 PM
          </div>

          {/* Seat Count Stepper */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
              Number of Seats (Brothers Hall)
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 999,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>2 Seats Reserved</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  −
                </span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>2</span>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#1E563B',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  +
                </span>
              </div>
            </div>
          </div>

          {/* Full Name Field (Iqraa Focused Green Ring Pill) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
              Your Name
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 999,
                background: '#F3FBF7',
                border: '1.5px solid #10B981',
              }}
            >
              <PhIcon name="user" weight="fill" size={16} color="#1E563B" />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>Usman Khan</span>
            </div>
          </div>

          {/* Mobile Phone Field */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
              Mobile Number (for SMS Seat Pass)
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 999,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <PhIcon name="phone" weight="fill" size={16} color="#64748B" />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                +92 300 419 8821
              </span>
            </div>
          </div>

          {/* 6-Digit OTP Verification Row */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: '#111827' }}>6-Digit SMS Code</span>
              <span style={{ color: '#10B981', fontWeight: 600 }}>Resend in 0:42</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {['4', '8', '2', '9', '1', '6'].map((digit, i) => (
                <div
                  key={i}
                  style={{
                    height: 46,
                    borderRadius: 12,
                    background: i < 4 ? '#F3FBF7' : '#F8FAFC',
                    border: i === 3 ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#111827',
                  }}
                >
                  {digit}
                </div>
              ))}
            </div>
          </div>

          <button type="button" className="iq-pill-cta dark" style={{ marginTop: 'auto' }}>
            Confirm 2 Seats →
          </button>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 03: JOURNEYSCREEN (MY RESERVED PASS + FOLLOWED MASJIDS)
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>03. JourneyScreen — Seat Pass & Followed Masjids</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PhIcon name="cell-signal-full" weight="bold" size={13} />
              <PhIcon name="wifi-high" weight="bold" size={13} />
              <PhIcon name="battery-full" weight="fill" size={15} />
            </div>
          </div>

          <div style={{ padding: '0 20px', fontSize: 20, fontWeight: 800, color: '#111827' }}>
            My Journey
          </div>

          {/* Confirmed Seat Pass Card */}
          <div className="iq-section" style={{ paddingTop: 16 }}>
            <div className="iq-section-head">
              <span className="iq-section-title">Upcoming Seat Pass</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#10B981' }}>Confirmed ✓</span>
            </div>

            <div className="iq-white-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                    Tafseer Surah Al-Kahf
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Jamia Masjid Al-Noor · Tonight 7:30 PM
                  </div>
                </div>
                <div
                  style={{
                    padding: 6,
                    borderRadius: 10,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <PhIcon name="qr-code" weight="regular" size={32} color="#111827" />
                </div>
              </div>

              <div
                style={{
                  margin: '14px 0',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: '#F8FAFC',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#64748B' }}>Pass #QC-8841</span>
                <span style={{ fontWeight: 700, color: '#111827' }}>2 Seats · Brothers Hall</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" className="iq-pill-cta" style={{ height: 36, fontSize: 12 }}>
                  <PhIcon name="path" weight="regular" size={14} /> Directions
                </button>
                <button
                  type="button"
                  className="iq-pill-cta"
                  style={{ height: 36, fontSize: 12, color: '#DC2626', borderColor: '#FECACA' }}
                >
                  Release Seat
                </button>
              </div>
            </div>
          </div>

          {/* Followed Masjids & Circles */}
          <div className="iq-section" style={{ paddingTop: 20 }}>
            <div className="iq-section-head">
              <span className="iq-section-title">Followed Masjids</span>
              <span style={{ fontSize: 12, color: '#64748B' }}>2</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { m: 'Jamia Masjid Al-Noor', s: 'Gulberg III · Daily Ayah & Room Updates' },
                { m: 'DHA Phase 4 Central Masjid', s: 'DHA · Dora-e-Quran Updates' },
              ].map((f) => (
                <div
                  key={f.m}
                  className="iq-white-card"
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PhIcon name="mosque" weight="duotone" size={20} color="#1E563B" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{f.m}</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>{f.s}</div>
                    </div>
                  </div>
                  <PhIcon name="bell-ringing" weight="fill" size={16} color="#10B981" />
                </div>
              ))}
            </div>
          </div>

          <nav className="iq-floating-nav">
            <button type="button" className="iq-nav-icon-btn" onClick={() => onNavigatePage('home')}>
              <PhIcon name="house" weight="regular" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn" onClick={() => onNavigatePage('nearby')}>
              <PhIcon name="compass" weight="regular" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn" onClick={() => onNavigatePage('quran')}>
              <PhIcon name="book-open" weight="regular" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn active">
              <PhIcon name="bookmarks" weight="fill" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn">
              <PhIcon name="user-circle" weight="regular" size={20} />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
