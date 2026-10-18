import React, { useState } from 'react';
import { PhIcon } from './icons';

export function TabUiPrimitives() {
  const [switchA, setSwitchA] = useState(true);
  const [switchB, setSwitchB] = useState(false);
  const [checkA, setCheckA] = useState(true);
  const [checkB, setCheckB] = useState(false);
  const [segMode, setSegMode] = useState<'list' | 'map'>('list');
  const [stepperVal, setStepperVal] = useState(2);
  const [activeDateIdx, setActiveDateIdx] = useState(2);
  const [activeChip, setActiveChip] = useState('After Maghrib');
  const [sheetPreview, setSheetPreview] = useState<'none' | 'filter' | 'confirm'>('none');

  const dateStripDays = [
    { day: 'Thu', greg: '16', hijri: '12 Ram', hasCircle: false },
    { day: 'Fri', greg: '17', hijri: '13 Ram', hasCircle: true },
    { day: 'Sat', greg: '18', hijri: '14 Ram', hasCircle: true },
    { day: 'Sun', greg: '19', hijri: '15 Ram', hasCircle: true },
    { day: 'Mon', greg: '20', hijri: '16 Ram', hasCircle: false },
    { day: 'Tue', greg: '21', hijri: '17 Ram', hasCircle: true },
    { day: 'Wed', greg: '22', hijri: '18 Ram', hasCircle: false },
  ];

  const prayers = [
    { name: 'Fajr', time: '4:42 AM', icon: 'sun-horizon', active: false },
    { name: 'Dhuhr', time: '12:15 PM', icon: 'sun', active: false },
    { name: 'Asr', time: '4:35 PM', icon: 'cloud-sun', active: false },
    { name: 'Maghrib', time: '6:28 PM', icon: 'sun-horizon', active: true },
    { name: 'Isha', time: '7:55 PM', icon: 'moon-stars', active: false },
  ];

  return (
    <div>
      <div className="wb-section-header">
        <div>
          <div className="wb-eyebrow">
            Part 2 · Complete @qc/ui Component Library (All 31 Exports)
          </div>
          <h1 className="wb-h1">Interactive Primitive Matrix — Every Variant & State</h1>
          <p className="wb-desc">
            Every single component exported in <code>packages/ui/src/index.ts</code> redesigned to
            replace generic flat styling with Iqraa tactile pills, Phosphor icons, and Al-Shamela
            visual restraint.
          </p>
        </div>
      </div>

      <div className="spec-grid-2">
        {/* PANEL 1: BUTTONS, ICONBUTTON, GLASSBUTTON */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="cursor-click" weight="duotone" size={20} color="#186A4B" />
              1. Button, IconButton & GlassButton
            </h3>
            <span className="spec-code-tag">Button · IconButton · GlassButton</span>
          </div>

          <div className="spec-sublabel">
            Variants (Primary Charcoal, Emerald, Outlined Secondary, Ghost, Danger)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="qc-btn qc-btn-primary">
              <PhIcon name="calendar-check" weight="bold" size={16} />
              Reserve Seat
            </button>
            <button type="button" className="qc-btn qc-btn-emerald">
              <PhIcon name="book-open-text" weight="bold" size={16} />
              Open Mushaf
            </button>
            <button type="button" className="qc-btn qc-btn-secondary">
              <PhIcon name="path" weight="regular" size={16} />
              Directions
              <PhIcon name="arrow-right" weight="bold" size={14} />
            </button>
            <button type="button" className="qc-btn qc-btn-ghost">
              Clear filters
            </button>
            <button type="button" className="qc-btn qc-btn-danger">
              <PhIcon name="x-circle" weight="regular" size={16} />
              Cancel Seat
            </button>
          </div>

          <div className="spec-sublabel">Sizes (sm · md · lg) & Loading / Disabled States</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
              Continue <PhIcon name="arrow-right" weight="bold" size={12} />
            </button>
            <button type="button" className="qc-btn qc-btn-primary">
              Medium Pill (44px)
            </button>
            <button type="button" className="qc-btn qc-btn-primary qc-btn-lg">
              Large Sticky CTA (52px)
            </button>
            <button
              type="button"
              className="qc-btn qc-btn-secondary"
              style={{ opacity: 0.65, cursor: 'wait' }}
            >
              <PhIcon name="spinner-gap" weight="bold" size={16} />
              Sending OTP…
            </button>
          </div>

          <div className="spec-sublabel">IconButton, GlassButton (with Unread Badge) & Avatar</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="qc-icon-btn glass" title="HomeBell with unread count">
              <PhIcon name="bell-ringing" weight="duotone" size={20} color="#186A4B" />
              <span className="qc-icon-btn-badge">3</span>
            </button>
            <button type="button" className="qc-icon-btn" title="Share">
              <PhIcon name="share-network" weight="regular" size={18} />
            </button>
            <button type="button" className="qc-icon-btn" title="Bookmark">
              <PhIcon name="bookmark-simple" weight="duotone" size={18} color="#186A4B" />
            </button>
            <button
              type="button"
              className="qc-icon-btn"
              style={{ background: '#186A4B', color: '#FFF', borderColor: '#186A4B' }}
              title="Active Filter Trigger"
            >
              <PhIcon name="sliders-horizontal" weight="bold" size={18} />
            </button>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px 4px 4px',
                borderRadius: 999,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#E1F5EC',
                  color: '#186A4B',
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                UK
              </div>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Avatar + Profile Pill</span>
            </div>
          </div>
        </div>

        {/* PANEL 2: TEXTFIELD, SEARCHFIELD, CODEFIELD (OTP) */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="textbox" weight="duotone" size={20} color="#186A4B" />
              2. TextField, SearchField & CodeField (OTP)
            </h3>
            <span className="spec-code-tag">TextField · SearchField · CodeField</span>
          </div>

          <div className="spec-sublabel">SearchField + Filter Trigger Row (Home & Nearby)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="qc-input-pill focused" style={{ flex: 1 }}>
              <PhIcon name="magnifying-glass" weight="bold" size={18} color="#186A4B" />
              <input
                type="text"
                defaultValue="Masjid Al-Noor, Gulberg III"
                aria-label="Search masjids"
              />
              <PhIcon name="x-circle" weight="fill" size={16} color="#94A3B8" />
            </div>
            <button
              type="button"
              className="qc-icon-btn"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: '#186A4B',
                color: '#FFF',
                border: 'none',
              }}
            >
              <PhIcon name="sliders-horizontal" weight="bold" size={18} />
              <span className="qc-icon-btn-badge">2</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="qc-field-group">
              <label className="qc-field-label">Phone Number (Default Pill)</label>
              <div className="qc-input-pill">
                <PhIcon name="phone" weight="duotone" size={18} color="#64748B" />
                <input type="text" defaultValue="+92 300 419 8821" />
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>
                We send a 6-digit SMS code for your seat pass.
              </span>
            </div>

            <div className="qc-field-group">
              <label className="qc-field-label" style={{ color: '#DC2626' }}>
                Validation Error State
              </label>
              <div className="qc-input-pill error">
                <PhIcon name="warning-circle" weight="fill" size={18} color="#DC2626" />
                <input type="text" defaultValue="0300-12" />
              </div>
              <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                Enter a complete 11-digit mobile number.
              </span>
            </div>
          </div>

          <div className="spec-sublabel">CodeField (6-Digit OTP Verification Cells)</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div className="qc-otp-row">
              <div className="qc-otp-cell filled">4</div>
              <div className="qc-otp-cell filled">8</div>
              <div className="qc-otp-cell filled">2</div>
              <div className="qc-otp-cell active">9</div>
              <div className="qc-otp-cell" />
              <div className="qc-otp-cell" />
            </div>
            <span style={{ fontSize: 12, color: '#186A4B', fontWeight: 600 }}>
              <PhIcon name="clock" weight="regular" size={14} /> Resend code in 0:42
            </span>
          </div>
        </div>

        {/* PANEL 3: TAGS, CHIPS & BADGES */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="tag" weight="duotone" size={20} color="#186A4B" />
              3. Tag, Chip & Badge Taxonomy
            </h3>
            <span className="spec-code-tag">Tag · Chip · Badge</span>
          </div>

          <div className="spec-sublabel">Section Tags (Brothers · Sisters · Families · Mixed)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="qc-badge qc-badge-emerald">
              <PhIcon name="user" weight="duotone" size={14} /> Brothers
            </span>
            <span
              className="qc-badge"
              style={{ background: '#FDF2F8', color: '#9D174D', border: '1px solid #FBCFE8' }}
            >
              <PhIcon name="sparkle" weight="duotone" size={14} /> Sisters Only
            </span>
            <span className="qc-badge qc-badge-info">
              <PhIcon name="users-four" weight="duotone" size={14} /> Families Welcome
            </span>
            <span className="qc-badge qc-badge-neutral">
              <PhIcon name="users-three" weight="duotone" size={14} /> Mixed Hall
            </span>
          </div>

          <div className="spec-sublabel">Program, Portion & Language Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="qc-badge qc-badge-amber">
              <PhIcon name="book-open-text" weight="duotone" size={14} /> Surah Al-Kahf · Ayah 1–31
            </span>
            <span className="qc-badge qc-badge-amber">
              <PhIcon name="moon-stars" weight="fill" size={13} /> Dora-e-Quran (Ramadan)
            </span>
            <span className="qc-badge qc-badge-emerald">
              <PhIcon name="video-camera" weight="duotone" size={14} /> Hybrid (In-person + Online)
            </span>
            <span className="qc-badge qc-badge-neutral">Urdu / English</span>
            <span className="qc-badge qc-badge-danger">
              <PhIcon name="warning-circle" weight="fill" size={13} /> Waitlist Only (30/30)
            </span>
          </div>

          <div className="spec-sublabel">Interactive Filter Chips & Removable Active Chips</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['After Fajr', 'After Asr', 'After Maghrib', 'After Isha'].map((band) => (
              <button
                key={band}
                type="button"
                className={`qc-chip ${activeChip === band ? 'selected' : ''}`}
                onClick={() => setActiveChip(band)}
              >
                <PhIcon
                  name={activeChip === band ? 'check-circle' : 'clock'}
                  weight={activeChip === band ? 'fill' : 'regular'}
                  size={14}
                />
                {band}
              </button>
            ))}
            <button type="button" className="qc-chip removable">
              Gulberg III
              <PhIcon name="x" weight="bold" size={12} />
            </button>
          </div>
        </div>

        {/* PANEL 4: CONTROLS — SEGMENTED, STEPPER, SWITCH, CHECKBOX, SELECT */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="toggles" weight="duotone" size={20} color="#186A4B" />
              4. SegmentedControl, Stepper, Switch, Checkbox & Select
            </h3>
            <span className="spec-code-tag">Interactive Controls</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div className="spec-sublabel" style={{ marginBottom: 6 }}>
                SegmentedControl (Nearby View Switcher)
              </div>
              <div className="qc-segmented">
                <button
                  type="button"
                  className={`qc-seg-btn ${segMode === 'list' ? 'active' : ''}`}
                  onClick={() => setSegMode('list')}
                >
                  <PhIcon name="list-bullets" weight="bold" size={15} />
                  List View (14)
                </button>
                <button
                  type="button"
                  className={`qc-seg-btn ${segMode === 'map' ? 'active' : ''}`}
                  onClick={() => setSegMode('map')}
                >
                  <PhIcon name="map-trifold" weight="duotone" size={15} />
                  Map View
                </button>
              </div>
            </div>

            <div>
              <div className="spec-sublabel" style={{ marginBottom: 6 }}>
                Stepper (Seat Count / Admin Headcount)
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  padding: '4px 8px',
                  borderRadius: 999,
                }}
              >
                <button
                  type="button"
                  className="qc-icon-btn"
                  style={{ width: 30, height: 30 }}
                  onClick={() => setStepperVal(Math.max(1, stepperVal - 1))}
                >
                  <PhIcon name="minus" weight="bold" size={14} />
                </button>
                <span style={{ fontWeight: 800, fontSize: 16, minWidth: 58, textAlign: 'center' }}>
                  {stepperVal} {stepperVal === 1 ? 'Seat' : 'Seats'}
                </span>
                <button
                  type="button"
                  className="qc-icon-btn"
                  style={{
                    width: 30,
                    height: 30,
                    background: '#186A4B',
                    color: '#FFF',
                    borderColor: '#186A4B',
                  }}
                  onClick={() => setStepperVal(Math.min(5, stepperVal + 1))}
                >
                  <PhIcon name="plus" weight="bold" size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="spec-sublabel">Switch & Checkbox Rows</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 12,
                background: '#F8FAFC',
                border: '1px solid #EDF2F7',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Maghrib Circle Reminders</span>
              <button
                type="button"
                className={`qc-switch ${switchA ? 'on' : ''}`}
                onClick={() => setSwitchA(!switchA)}
              >
                <span className="qc-switch-thumb" />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 12,
                background: '#F8FAFC',
                border: '1px solid #EDF2F7',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Save Schedule Offline</span>
              <button
                type="button"
                className={`qc-switch ${switchB ? 'on' : ''}`}
                onClick={() => setSwitchB(!switchB)}
              >
                <span className="qc-switch-thumb" />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setCheckA(!checkA)}
            >
              <PhIcon
                name={checkA ? 'check-square' : 'square'}
                weight={checkA ? 'fill' : 'regular'}
                size={20}
                color={checkA ? '#186A4B' : '#64748B'}
              />
              Sisters Dedicated Hall
            </label>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setCheckB(!checkB)}
            >
              <PhIcon
                name={checkB ? 'check-square' : 'square'}
                weight={checkB ? 'fill' : 'regular'}
                size={20}
                color={checkB ? '#186A4B' : '#64748B'}
              />
              Step-Free Wheelchair Access
            </label>
          </div>
        </div>

        {/* PANEL 5: SEATMETER, DATESTRIP & STARNUMBER */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="chart-bar-horizontal" weight="duotone" size={20} color="#186A4B" />
              5. SeatMeter, DateStrip & StarNumber
            </h3>
            <span className="spec-code-tag">SeatMeter · DateStrip · StarNumber</span>
          </div>

          <div className="spec-sublabel">SeatMeter (3 Capacity Threshold States)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="qc-seat-meter">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#186A4B' }}>
                  <PhIcon name="users" weight="duotone" size={14} /> 22 seats available
                </span>
                <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                  18 / 40 reserved
                </span>
              </div>
              <div className="qc-seat-bar">
                <div className="qc-seat-fill" style={{ width: '45%', background: '#239B73' }} />
              </div>
            </div>

            <div className="qc-seat-meter">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: '#B45309' }}>
                  <PhIcon name="fire" weight="duotone" size={14} /> Filling fast · Only 3 seats left
                </span>
                <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                  27 / 30 reserved
                </span>
              </div>
              <div className="qc-seat-bar">
                <div className="qc-seat-fill" style={{ width: '90%', background: '#F5820B' }} />
              </div>
            </div>

            <div className="qc-seat-meter">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: '#DC2626' }}>
                  <PhIcon name="clock-countdown" weight="duotone" size={14} /> Circle Full ·
                  Waitlist Open (4 waiting)
                </span>
                <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                  30 / 30 reserved
                </span>
              </div>
              <div className="qc-seat-bar">
                <div className="qc-seat-fill" style={{ width: '100%', background: '#DC2626' }} />
              </div>
            </div>
          </div>

          <div className="spec-sublabel">DateStrip (Interactive 7-Day Gregorian + Hijri Strip)</div>
          <div className="qc-datestrip">
            {dateStripDays.map((d, idx) => {
              const active = idx === activeDateIdx;
              return (
                <div
                  key={d.greg}
                  className={`qc-date-cell ${active ? 'active' : ''}`}
                  onClick={() => setActiveDateIdx(idx)}
                >
                  <div style={{ fontSize: 10, opacity: active ? 0.85 : 0.65, fontWeight: 600 }}>
                    {d.day}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, margin: '2px 0' }}>{d.greg}</div>
                  <div style={{ fontSize: 9.5, opacity: active ? 0.9 : 0.6 }}>{d.hijri}</div>
                  {d.hasCircle && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: active ? '#FFB04D' : '#186A4B',
                        margin: '4px auto 0',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL 6: PRAYERSTRIP & LISTITEM */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="mosque" weight="duotone" size={20} color="#186A4B" />
              6. PrayerStrip & ListItem Rows
            </h3>
            <span className="spec-code-tag">PrayerStrip · ListItem</span>
          </div>

          <div className="spec-sublabel">
            PrayerStrip (Athar 5-Waqt Strip with Phosphor Celestial Icons)
          </div>
          <div className="qc-prayer-strip">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                padding: '0 4px',
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#186A4B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <PhIcon name="mosque" weight="duotone" size={15} /> Lahore · Next: Maghrib in 24m
              </span>
              <span style={{ fontSize: 11, color: '#64748B' }}>14 Ramadan 1447</span>
            </div>
            <div className="qc-prayer-row">
              {prayers.map((p) => (
                <div key={p.name} className={`qc-prayer-pill ${p.active ? 'active' : ''}`}>
                  <PhIcon
                    name={p.icon}
                    weight={p.active ? 'fill' : 'duotone'}
                    size={18}
                    color={p.active ? '#186A4B' : '#64748B'}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: p.active ? 800 : 600,
                      color: p.active ? '#103A2A' : '#475569',
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: p.active ? 700 : 500,
                      color: p.active ? '#186A4B' : '#94A3B8',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {p.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="spec-sublabel">
            ListItem (Venue Row & Ustadh Row with Avatar + Chevron)
          </div>
          <div
            style={{
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              background: '#FFF',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: '1px solid #EDF2F7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="ph-catalog-icon-box">
                  <PhIcon name="mosque" weight="duotone" size={20} color="#186A4B" />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>Jamia Masjid Al-Noor</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Main Boulevard, Gulberg III · 0.8 km away
                  </div>
                </div>
              </div>
              <PhIcon name="caret-right" weight="bold" size={16} color="#94A3B8" />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#FFF3E0',
                    color: '#B45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  UA
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>Ustadh Ahmad Al-Azhari</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Weekly Tafseer Circle · 12 occurrences completed
                  </div>
                </div>
              </div>
              <span className="qc-badge qc-badge-emerald">Verified Scholar</span>
            </div>
          </div>
        </div>

        {/* PANEL 7: BANNERS, TOASTS & FEEDBACK */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="megaphone" weight="duotone" size={20} color="#186A4B" />
              7. Banner & Toast Feedback States
            </h3>
            <span className="spec-code-tag">Banner · Toast</span>
          </div>

          <div className="qc-banner offline">
            <PhIcon name="cloud-slash" weight="duotone" size={20} color="#B45309" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Offline Mode — Showing Saved Copy</div>
              <div style={{ fontSize: 11.5, opacity: 0.9 }}>
                Last updated today at 5:10 PM. Your seat passes and Mushaf pages work offline.
              </div>
            </div>
          </div>

          <div className="qc-banner info">
            <PhIcon name="bell-ringing" weight="duotone" size={20} color="#186A4B" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Coordinator Update · Masjid Al-Noor</div>
              <div style={{ fontSize: 11.5 }}>
                Tonight&apos;s circle moves to the First Floor Eastern Hall after Maghrib.
              </div>
            </div>
          </div>

          <div className="qc-banner danger">
            <PhIcon name="warning-octagon" weight="fill" size={20} color="#DC2626" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Occurrence Cancelled (18 Ramadan)</div>
              <div style={{ fontSize: 11.5 }}>
                This Friday&apos;s session is paused due to Masjid maintenance. Resumes next week.
              </div>
            </div>
          </div>

          <div className="spec-sublabel">Floating Toast Notification</div>
          <div
            style={{
              background: '#111827',
              color: '#FFFFFF',
              padding: '11px 16px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12.5,
              fontWeight: 600,
              boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
              alignSelf: 'flex-start',
            }}
          >
            <PhIcon name="check-circle" weight="fill" size={18} color="#34D399" />
            Counted as a day read! May Allah accept your tilawah.
          </div>
        </div>

        {/* PANEL 8: SKELETON, EMPTYSTATE, ERRORSTATE, SHEET & CONFIRMSHEET */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="stack" weight="duotone" size={20} color="#186A4B" />
              8. Skeleton, EmptyState, ErrorState & Bottom Sheets
            </h3>
            <span className="spec-code-tag">Skeleton · EmptyState · Sheet · ConfirmSheet</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* EmptyState */}
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div className="ph-catalog-icon-box" style={{ borderRadius: '50%' }}>
                <PhIcon name="compass" weight="duotone" size={22} color="#186A4B" />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>No circles match these filters</div>
              <div style={{ fontSize: 11.5, color: '#64748B' }}>
                Try clearing &ldquo;After Fajr&rdquo; or request a circle at your local masjid.
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
                  Clear filters
                </button>
                <button type="button" className="qc-btn qc-btn-ghost qc-btn-sm">
                  Request Circle
                </button>
              </div>
            </div>

            {/* Skeleton + Sheet Trigger */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid #EDF2F7',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8' }}>
                  SKELETON SHIMMER STATE
                </div>
                <div className="qc-skeleton" style={{ height: 14, width: '65%' }} />
                <div className="qc-skeleton" style={{ height: 11, width: '90%' }} />
                <div
                  className="qc-skeleton"
                  style={{ height: 28, width: '100%', borderRadius: 999 }}
                />
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: '#F3FBF7',
                  border: '1px solid #BFE8D6',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#103A2A', marginBottom: 6 }}>
                  Sheet & ConfirmSheet Modals
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="qc-btn qc-btn-secondary qc-btn-sm"
                    onClick={() => setSheetPreview(sheetPreview === 'filter' ? 'none' : 'filter')}
                  >
                    <PhIcon name="sliders-horizontal" weight="bold" size={13} />
                    {sheetPreview === 'filter' ? 'Hide Sheet' : 'Preview Filter Sheet'}
                  </button>
                  <button
                    type="button"
                    className="qc-btn qc-btn-danger qc-btn-sm"
                    onClick={() => setSheetPreview(sheetPreview === 'confirm' ? 'none' : 'confirm')}
                  >
                    {sheetPreview === 'confirm' ? 'Hide' : 'ConfirmSheet'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {sheetPreview !== 'none' && (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: '#FFFFFF',
                border: '2px solid #186A4B',
                boxShadow: '0 10px 25px rgba(16,58,42,0.12)',
              }}
            >
              <div className="phone-sheet-handle" />
              {sheetPreview === 'filter' ? (
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
                    FiltersSheet (Time Band · Section · Program · Language)
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span className="qc-chip selected">After Maghrib</span>
                    <span className="qc-chip">After Isha</span>
                    <span className="qc-chip selected">Brothers</span>
                    <span className="qc-chip">Sisters</span>
                    <span className="qc-chip">Dora-e-Quran</span>
                  </div>
                  <button
                    type="button"
                    className="qc-btn qc-btn-primary qc-btn-sm"
                    onClick={() => setSheetPreview('none')}
                  >
                    Show 8 Matching Circles
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#DC2626', marginBottom: 4 }}>
                    Cancel your seat reservation?
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
                    Your seat at Masjid Al-Noor (Tonight, 7:30 PM) will be released to the next
                    person on the waitlist.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="qc-btn qc-btn-secondary qc-btn-sm"
                      onClick={() => setSheetPreview('none')}
                    >
                      Keep My Seat
                    </button>
                    <button
                      type="button"
                      className="qc-btn qc-btn-danger qc-btn-sm"
                      onClick={() => setSheetPreview('none')}
                    >
                      Yes, Release Seat
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
