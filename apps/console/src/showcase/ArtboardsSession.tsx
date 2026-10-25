import React, { useState } from 'react';
import { PhIcon } from './icons';

export function ArtboardsSession({ onNavigatePage }: { onNavigatePage: (page: string) => void }) {
  const [phoneVal, setPhoneVal] = useState('300 1234567');
  const [codeVal] = useState(['5', '2', '9', '4', '1', '8']);
  const [nameVal, setNameVal] = useState('Usman Khan');

  return (
    <div className="artboard-row">
      {/* ======================================================================
          ARTBOARD 01: SESSIONSCREEN (HALQA DETAIL & FOLLOW)
          Pure Halqa Focus: Times, Venue, Teacher, Portions & WhatsApp Alerts
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>01. Halqa Detail — Venue, Times, Teacher & Alerts</span>
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

                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
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
                      backdropFilter: 'blur(8px)',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    Weekly Dora-e-Quran
                  </span>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'rgba(16,185,129,0.3)',
                      color: '#A7F3D0',
                      backdropFilter: 'blur(8px)',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Brothers &amp; Sisters
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.25,
                  }}
                >
                  Tafseer Surah Al-Kahf
                </div>
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.9,
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PhIcon name="map-pin" weight="fill" size={12} />
                  <span>Jamia Masjid Al-Noor, Gulberg III · 0.8 km</span>
                </div>
              </div>
            </div>
          </div>

          {/* Overlapping Content Container */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Timing & Countdown Card */}
            <div className="iq-white-card" style={{ padding: '14px 16px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#10B981',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    Tonight at 7:30 PM
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>· After Maghrib</span>
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: '#ECFDF5',
                    color: '#065F46',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  In 2h 15m
                </span>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: 8,
                  borderTop: '1px solid #F1F5F9',
                }}
              >
                <PhIcon name="calendar-check" weight="duotone" size={16} color="#1E563B" />
                <span>Every Thursday evening · Urdu translation &amp; commentary</span>
              </div>
            </div>

            {/* Teacher / Khateeb Card */}
            <div className="iq-white-card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1E563B 0%, #154228 100%)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  MI
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    Dr. Muhammad Israr
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                    Tanzeem-e-Islami Lahore · Ustadh Ahmad reciter
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#F1F5F9',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#475569',
                  }}
                >
                  In-Person
                </span>
              </div>
            </div>

            {/* Upcoming Schedule & Designated Portions */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                  Weekly Portions (Syllabus)
                </span>
                <span
                  style={{ fontSize: 11.5, color: '#1E563B', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => onNavigatePage('quran')}
                >
                  Open in Reader &rarr;
                </span>
              </div>
              <div className="iq-white-card" style={{ padding: '6px 14px' }}>
                {[
                  { d: 'Tonight · 7:30 PM', p: 'Surah Al-Kahf : 1–31', active: true },
                  { d: 'Thu, 25 Oct · 7:30 PM', p: 'Surah Al-Kahf : 32–59', active: false },
                  { d: 'Thu, 1 Nov · 7:30 PM', p: 'Surah Al-Kahf : 60–82', active: false },
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {occ.active && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#10B981',
                          }}
                        />
                      )}
                      <span style={{ fontWeight: occ.active ? 700 : 500, color: '#334155' }}>
                        {occ.d}
                      </span>
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        color: occ.active ? '#B45309' : '#64748B',
                        background: occ.active ? '#FFFBEB' : '#F8FAFC',
                        padding: '3px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                      }}
                    >
                      {occ.p}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notification & Alert Guarantee */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: '#F0FDF4',
                border: '1px solid #DCFCE7',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <PhIcon name="whatsapp-logo" weight="fill" size={24} color="#16A34A" />
              <div style={{ flex: 1, fontSize: 11.5, color: '#166534', lineHeight: 1.4 }}>
                <strong>WhatsApp Reminders:</strong> Receive session reminders 1 hour before, timing
                changes &amp; tomorrow&apos;s portion directly.
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
                  <PhIcon name="check-circle" weight="fill" size={13} color="#1E563B" />
                  {f.l}
                </span>
              ))}
            </div>
          </div>

          {/* Sticky Bottom CTAs (No seats! Just Follow for WhatsApp alerts + Directions) */}
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: 20,
              right: 20,
              display: 'grid',
              gridTemplateColumns: '1.8fr 1fr',
              gap: 8,
            }}
          >
            <button
              type="button"
              className="iq-pill-cta"
              style={{ background: '#16A34A', color: '#FFFFFF', borderColor: '#16A34A' }}
            >
              <PhIcon name="whatsapp-logo" weight="fill" size={16} />
              <span>Follow for Alerts</span>
            </button>
            <button
              type="button"
              className="iq-pill-cta"
              style={{ background: '#F8FAFC', color: '#1E293B', borderColor: '#E2E8F0' }}
            >
              <PhIcon name="navigation-arrow" weight="bold" size={14} />
              <span>Directions</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 02: INLINE JOIN SHEET (FIXING THE AUTH BOTTLENECK)
          Frictionless 2-step phone + OTP sheet directly over the halqa screen
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>02. Inline Join Sheet — Zero-Friction Phone &amp; OTP</span>
          <span>375 × 812</span>
        </div>

        <div
          className="ios-artboard"
          style={{ position: 'relative', overflow: 'hidden', padding: 0 }}
        >
          {/* Dimmed Background Representing the Session Screen Behind */}
          <div
            style={{ filter: 'blur(3px) brightness(0.65)', padding: '14px 20px', height: '100%' }}
          >
            <div className="iq-status-row" style={{ color: '#FFFFFF', marginBottom: 14 }}>
              <span>9:41</span>
            </div>
            <div
              style={{
                height: 180,
                borderRadius: 18,
                background: '#154228',
                marginBottom: 16,
              }}
            />
            <div className="iq-white-card" style={{ height: 120, marginBottom: 12 }} />
            <div className="iq-white-card" style={{ height: 160 }} />
          </div>

          {/* Semi-transparent Dimming Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10, 20, 15, 0.55)',
              zIndex: 10,
            }}
          />

          {/* Animated Elegant Bottom Sheet */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: '12px 22px 30px',
              zIndex: 20,
              boxShadow: '0 -10px 40px rgba(0,0,0,0.22)',
            }}
          >
            {/* Grab Handle */}
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 999,
                background: '#E2E8F0',
                margin: '0 auto 16px',
              }}
            />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: '#DCFCE7',
                    color: '#15803D',
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  <PhIcon name="bell-ringing" weight="fill" size={12} />
                  Join Halqa Alerts
                </span>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>
                  Follow Jamia Masjid Al-Noor
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                  Get reminders 1h before halqa, timing updates, and portion links.
                </div>
              </div>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: '#F1F5F9',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                  cursor: 'pointer',
                }}
              >
                <PhIcon name="x" weight="bold" size={14} />
              </button>
            </div>

            {/* Step 1: Pakistani Phone Number */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Pakistani Mobile / WhatsApp Number
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#F8FAFC',
                  border: '1.5px solid #22C55E',
                  borderRadius: 14,
                  padding: '10px 14px',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: '#111827',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>🇵🇰 +92</span>
                  <span style={{ color: '#CBD5E1' }}>|</span>
                </span>
                <input
                  type="text"
                  value={phoneVal}
                  onChange={(e) => setPhoneVal(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#111827',
                    outline: 'none',
                    width: '100%',
                    letterSpacing: '0.04em',
                  }}
                />
                <PhIcon name="whatsapp-logo" weight="fill" size={18} color="#16A34A" />
              </div>
            </div>

            {/* Step 2: 6-Digit Code */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  6-Digit Verification Code
                </label>
                <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
                  Resend in 0:28
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {codeVal.map((digit, i) => (
                  <div
                    key={i}
                    style={{
                      height: 44,
                      borderRadius: 10,
                      border: '1.5px solid #E2E8F0',
                      background: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#111827',
                    }}
                  >
                    {digit}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Name Input (Only on first sign up) */}
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 6,
                  display: 'block',
                }}
              >
                Your Name (for Coordinator Roster)
              </label>
              <input
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                style={{
                  width: '100%',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '10px 14px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Submit Action */}
            <button
              type="button"
              className="iq-pill-cta"
              style={{
                background: '#1E563B',
                color: '#FFFFFF',
                borderColor: '#1E563B',
                width: '100%',
                padding: '13px',
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              <PhIcon name="check-circle" weight="fill" size={17} />
              <span>Confirm &amp; Follow Halqa</span>
            </button>

            <div
              style={{
                fontSize: 11,
                color: '#64748B',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <PhIcon name="shield-check" weight="fill" size={14} color="#10B981" />
              <span>No spam. You can unfollow or mute alerts anytime with 1 tap.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 03: MY CIRCLES & JOURNEY (FOLLOWED HALQAS + HABIT TRACKER)
          Real Seeker Command Center: Followed Circles, Habit Streak & Updates
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>03. My Circles Screen — Followed Halqas &amp; Habit Tracker</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ padding: '14px 20px 84px' }}>
          {/* Top Status Row */}
          <div className="iq-status-row" style={{ color: '#111827', marginBottom: 12 }}>
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PhIcon name="cell-signal-full" weight="bold" size={13} />
              <PhIcon name="wifi-high" weight="bold" size={13} />
              <PhIcon name="battery-full" weight="fill" size={15} />
            </div>
          </div>

          {/* Screen Title */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#111827',
                  letterSpacing: '-0.02em',
                }}
              >
                My Circles &amp; Habit
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                2 Followed Halqas · Lahore
              </div>
            </div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: '#ECFDF5',
                color: '#065F46',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Signed In as Usman
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Followed Halqa Card (Tonight) */}
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Followed Halqas
              </div>

              {/* Card 1: Jamia Masjid Al-Noor */}
              <div
                className="iq-white-card"
                style={{
                  padding: 16,
                  borderLeft: '4px solid #1E563B',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 6,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#059669',
                        background: '#ECFDF5',
                        padding: '2px 7px',
                        borderRadius: 999,
                      }}
                    >
                      Tonight · 7:30 PM
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginTop: 4 }}>
                      Tafseer Surah Al-Kahf
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                      Jamia Masjid Al-Noor, Gulberg III
                    </div>
                  </div>

                  {/* WhatsApp Alerts Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#F0FDF4',
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: '1px solid #DCFCE7',
                    }}
                  >
                    <PhIcon name="whatsapp-logo" weight="fill" size={14} color="#16A34A" />
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#166534' }}>
                      Alerts ON
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 10,
                    marginTop: 8,
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#B45309',
                      background: '#FFFBEB',
                      padding: '3px 8px',
                      borderRadius: 999,
                    }}
                  >
                    Tonight: Al-Kahf 1–31
                  </span>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onNavigatePage('quran')}
                      style={{
                        border: 'none',
                        background: '#1E563B',
                        color: '#FFFFFF',
                        padding: '5px 11px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <PhIcon name="book-open-text" weight="regular" size={13} />
                      <span>Read Portion</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        color: '#334155',
                        padding: '5px 9px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Directions
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: DHA Phase 4 Central */}
              <div className="iq-white-card" style={{ padding: '12px 16px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                      Surah Yaseen Halqa
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                      DHA Phase 4 Masjid · Saturday Fajr
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#F0FDF4',
                      padding: '3px 8px',
                      borderRadius: 999,
                    }}
                  >
                    <PhIcon name="whatsapp-logo" weight="fill" size={13} color="#16A34A" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#166534' }}>ON</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Your Daily Quran Habit Tracker (Days Read) */}
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Days Read This Week</span>
                <span
                  style={{
                    fontSize: 11.5,
                    color: '#059669',
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  5 of 7 Days Read
                </span>
              </div>

              <div className="iq-white-card" style={{ padding: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                    const done = i < 5;
                    const isToday = i === 4;
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#94A3B8' }}>
                          {day}
                        </span>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: done ? '#1E563B' : '#F1F5F9',
                            color: done ? '#FFFFFF' : '#94A3B8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            border: isToday ? '2px solid #10B981' : 'none',
                          }}
                        >
                          {done ? <PhIcon name="check" weight="bold" size={15} /> : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11.5,
                      color: '#475569',
                    }}
                  >
                    <PhIcon name="fire" weight="fill" size={16} color="#EA580C" />
                    <span>
                      <strong>14 days read</strong> this month
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigatePage('quran')}
                    style={{
                      border: 'none',
                      background: '#ECFDF5',
                      color: '#065F46',
                      padding: '5px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Open Quran &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Live Coordinator Announcements Feed */}
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Coordinator Announcements
              </div>

              <div
                className="iq-white-card"
                style={{
                  padding: 14,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#FEF3C7',
                    color: '#B45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PhIcon name="megaphone" weight="fill" size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>
                    Jamia Masjid Al-Noor · 1h ago
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>
                    Tonight&apos;s halqa will start 15 minutes after Maghrib prayer to allow
                    brothers joining from out of town to settle.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Pill Tab Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 20,
              right: 20,
              background: '#FFFFFF',
              borderRadius: 999,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              border: '1px solid #F1F5F9',
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {[
              { id: 'home', l: 'Home', ic: 'house', active: false },
              { id: 'nearby', l: 'Nearby', ic: 'compass', active: false },
              { id: 'quran', l: 'Quran', ic: 'book-open-text', active: false },
              { id: 'session', l: 'My Circles', ic: 'heart', active: true },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigatePage(tab.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  color: tab.active ? '#1E563B' : '#94A3B8',
                  fontSize: 10,
                  fontWeight: tab.active ? 700 : 500,
                  cursor: 'pointer',
                  padding: '2px 8px',
                }}
              >
                <PhIcon name={tab.ic} weight={tab.active ? 'fill' : 'regular'} size={18} />
                <span>{tab.l}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
