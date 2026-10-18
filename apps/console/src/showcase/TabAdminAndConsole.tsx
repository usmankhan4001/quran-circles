import React, { useState } from 'react';
import { PhIcon, GirihWatermarkSvg, AyahMedallion } from './icons';

type AdminScreenId =
  | 'today'
  | 'attendance'
  | 'schedule'
  | 'postUpdate'
  | 'posters'
  | 'dailyAyah'
  | 'places';

type ConsolePageId =
  | 'sessions'
  | 'venues'
  | 'registrations'
  | 'coordinators'
  | 'import'
  | 'exports'
  | 'dailyAyahs'
  | 'posters'
  | 'audit';

export function TabAdminAndConsole() {
  const [adminScreen, setAdminScreen] = useState<AdminScreenId>('today');
  const [headcount, setHeadcount] = useState(34);
  const [consolePage, setConsolePage] = useState<ConsolePageId>('sessions');

  const adminScreens: { id: AdminScreenId; label: string; icon: string; file: string }[] = [
    { id: 'today', label: '1. TodayScreen (Field Hub)', icon: 'calendar-check', file: 'features/today/TodayScreen.tsx' },
    { id: 'attendance', label: '2. AttendanceScreen (Stepper)', icon: 'users-three', file: 'features/today/AttendanceScreen.tsx' },
    { id: 'schedule', label: '3. Schedule & Portion Picker', icon: 'book-open-text', file: 'features/schedule/OccurrenceScreen.tsx' },
    { id: 'postUpdate', label: '4. PostUpdateScreen (Broadcast)', icon: 'megaphone', file: 'features/updates/PostUpdateScreen.tsx' },
    { id: 'posters', label: '5. PostersScreen (A4 / WhatsApp)', icon: 'file-pdf', file: 'features/posters/PostersScreen.tsx' },
    { id: 'dailyAyah', label: '6. DailyAyahScreen (AyahPickCard)', icon: 'sparkle', file: 'features/ayah/DailyAyahScreen.tsx' },
    { id: 'places', label: '7. Places & VenueEditorScreen', icon: 'mosque', file: 'features/places/VenueEditorScreen.tsx' },
  ];

  const consolePages: { id: ConsolePageId; label: string; icon: string; count?: string }[] = [
    { id: 'sessions', label: 'Sessions & Schedules', icon: 'calendar-blank', count: '142' },
    { id: 'venues', label: 'Masjids & Venues', icon: 'mosque', count: '68' },
    { id: 'registrations', label: 'Registrations & Waitlist', icon: 'ticket', count: '1,840' },
    { id: 'coordinators', label: 'Coordinators & Scopes', icon: 'user-check', count: '94' },
    { id: 'import', label: 'Bulk CSV Import', icon: 'file-csv' },
    { id: 'exports', label: 'Reports & Exports', icon: 'download-simple' },
    { id: 'dailyAyahs', label: 'National Daily Ayahs', icon: 'book-open-text' },
    { id: 'posters', label: 'Print Flyer Generator', icon: 'printer' },
    { id: 'audit', label: 'Security Audit Log', icon: 'shield-check' },
  ];

  return (
    <div>
      <div className="wb-section-header">
        <div>
          <div className="wb-eyebrow">Part 5 · Coordinator Admin App & Desktop Web Console</div>
          <h1 className="wb-h1">Field Coordinator Screens & Operations Console</h1>
          <p className="wb-desc">
            Every screen in <code>@qc/admin-app</code> (used by Masjid coordinators after prayer)
            and every page in <code>@qc/console</code> (used by regional operations teams).
          </p>
        </div>
      </div>

      {/* SECTION A: COORDINATOR ADMIN APP (7 FIELD SCREENS) */}
      <div className="explorer-layout" style={{ marginBottom: 36 }}>
        <div className="screen-selector-list">
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', padding: '6px 10px', textTransform: 'uppercase' }}>
            Coordinator App Screens (@qc/admin-app)
          </div>
          {adminScreens.map((s) => {
            const active = adminScreen === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`screen-selector-btn ${active ? 'active' : ''}`}
                onClick={() => setAdminScreen(s.id)}
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
                    }}
                  >
                    <PhIcon name={s.icon} weight={active ? 'fill' : 'duotone'} size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 10.5, color: '#64748B' }}>{s.file}</div>
                  </div>
                </div>
                <PhIcon name="caret-right" weight="bold" size={14} color={active ? '#186A4B' : '#CBD5E1'} />
              </button>
            );
          })}
        </div>

        {/* COORDINATOR PHONE SIMULATOR */}
        <div className="phone-device">
          <div className="phone-status-bar">
            <span>7:25 PM</span>
            <span className="qc-badge qc-badge-emerald" style={{ fontSize: 10, padding: '2px 8px' }}>
              Coordinator Mode
            </span>
          </div>

          <div className="phone-scroll-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* ScopeSwitcher Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhIcon name="mosque" weight="duotone" size={18} color="#186A4B" />
                <div>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700 }}>ACTIVE MASJID SCOPE</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800 }}>Jamia Masjid Al-Noor, Gulberg</div>
                </div>
              </div>
              <PhIcon name="caret-up-down" weight="bold" size={15} color="#64748B" />
            </div>

            {adminScreen === 'today' && (
              <>
                <div className="qc-hero-emerald" style={{ padding: 16 }}>
                  <div className="qc-hero-girih">
                    <GirihWatermarkSvg />
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#A7F3D0', textTransform: 'uppercase' }}>
                    Starting in 5 Minutes · 7:30 PM
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                    Tafseer Surah Al-Kahf
                  </div>
                  <div style={{ fontSize: 12, color: '#D1FAE5', marginTop: 2 }}>
                    28 Registered · 12 Checked In · Portion: Al-Kahf 1–31
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="qc-btn qc-btn-white-hero qc-btn-sm"
                      onClick={() => setAdminScreen('attendance')}
                    >
                      <PhIcon name="users-three" weight="fill" size={14} /> Log Attendance
                    </button>
                    <button
                      type="button"
                      className="qc-btn qc-btn-sm"
                      style={{ background: 'rgba(255,255,255,0.15)', color: '#FFF', border: '1px solid rgba(255,255,255,0.25)' }}
                      onClick={() => setAdminScreen('postUpdate')}
                    >
                      <PhIcon name="megaphone" weight="bold" size={14} /> Post Update
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                  Coordinator Quick Actions
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { l: 'Set Portion', ic: 'book-open-text', s: 'schedule' as AdminScreenId },
                    { l: 'Masjid Poster', ic: 'file-pdf', s: 'posters' as AdminScreenId },
                    { l: 'Pick Daily Ayah', ic: 'sparkle', s: 'dailyAyah' as AdminScreenId },
                    { l: 'Edit Facilities', ic: 'mosque', s: 'places' as AdminScreenId },
                  ].map((q) => (
                    <button
                      key={q.l}
                      type="button"
                      className="qc-session-card"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, textAlign: 'left' }}
                      onClick={() => setAdminScreen(q.s)}
                    >
                      <PhIcon name={q.ic} weight="duotone" size={20} color="#186A4B" />
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{q.l}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {adminScreen === 'attendance' && (
              <>
                <div className="qc-session-card" style={{ textAlign: 'center', padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#186A4B', textTransform: 'uppercase' }}>
                    Total Headcount in Hall (Including Walk-Ins)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, margin: '14px 0' }}>
                    <button
                      type="button"
                      className="qc-icon-btn"
                      style={{ width: 46, height: 46 }}
                      onClick={() => setHeadcount(Math.max(0, headcount - 1))}
                    >
                      <PhIcon name="minus" weight="bold" size={20} />
                    </button>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, color: '#103A2A', fontVariantNumeric: 'tabular-nums' }}>
                      {headcount}
                    </span>
                    <button
                      type="button"
                      className="qc-icon-btn"
                      style={{ width: 46, height: 46, background: '#186A4B', color: '#FFF', borderColor: '#186A4B' }}
                      onClick={() => setHeadcount(headcount + 1)}
                    >
                      <PhIcon name="plus" weight="bold" size={20} />
                    </button>
                  </div>
                  <button type="button" className="qc-btn qc-btn-primary qc-btn-sm" style={{ width: '100%' }}>
                    Save Headcount ({headcount} Attendees)
                  </button>
                </div>

                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                  Registered Seat Holders (28)
                </div>
                {[
                  { name: 'Bilal Mahmood', seats: 2, checked: true },
                  { name: 'Hamza Tariq', seats: 1, checked: true },
                  { name: 'Zain ul Abideen', seats: 3, checked: false },
                ].map((r) => (
                  <div key={r.name} className="qc-session-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{r.seats} seats reserved</div>
                    </div>
                    <span className={`qc-badge ${r.checked ? 'qc-badge-emerald' : 'qc-badge-neutral'}`}>
                      <PhIcon name={r.checked ? 'check-circle' : 'circle'} weight={r.checked ? 'fill' : 'regular'} size={14} />
                      {r.checked ? 'Present' : 'Check In'}
                    </span>
                  </div>
                ))}
              </>
            )}

            {adminScreen === 'schedule' && (
              <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Set Tonight&apos;s Reading Portion</div>
                <div className="qc-field-group">
                  <label className="qc-field-label">Surah</label>
                  <div className="qc-input-pill focused">
                    <PhIcon name="book-open-text" weight="duotone" size={18} color="#186A4B" />
                    <input type="text" defaultValue="18 · Surah Al-Kahf" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="qc-field-group">
                    <label className="qc-field-label">From Ayah</label>
                    <div className="qc-input-pill"><input type="text" defaultValue="1" /></div>
                  </div>
                  <div className="qc-field-group">
                    <label className="qc-field-label">To Ayah</label>
                    <div className="qc-input-pill"><input type="text" defaultValue="31" /></div>
                  </div>
                </div>
                <button type="button" className="qc-btn qc-btn-primary">
                  Publish Portion to ReadAlongCard
                </button>
              </div>
            )}

            {adminScreen === 'postUpdate' && (
              <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Broadcast Update to Followers</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="qc-chip selected">Room Change</span>
                  <span className="qc-chip">Time Shift</span>
                  <span className="qc-chip">Portion Reminder</span>
                </div>
                <div className="qc-input-pill" style={{ alignItems: 'flex-start' }}>
                  <textarea
                    rows={3}
                    style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 12.5 }}
                    defaultValue="Assalamu Alaikum — tonight’s Tafseer circle will meet in the First Floor Eastern Hall immediately after Maghrib."
                  />
                </div>
                <div style={{ fontSize: 11, color: '#186A4B', fontWeight: 600 }}>
                  <PhIcon name="users" weight="duotone" size={14} /> Will notify 142 circle followers + 28 registrants
                </div>
                <button type="button" className="qc-btn qc-btn-emerald">
                  <PhIcon name="paper-plane-tilt" weight="fill" size={15} /> Send Update Now
                </button>
              </div>
            )}

            {adminScreen === 'posters' && (
              <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Masjid Noticeboard & WhatsApp Poster</div>
                <div className="qc-hero-emerald" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#A7F3D0', fontWeight: 800 }}>JAMIA MASJID AL-NOOR · GULBERG III</div>
                  <div style={{ fontSize: 17, fontWeight: 800, margin: '6px 0' }}>Weekly Tafseer Surah Al-Kahf</div>
                  <div style={{ fontSize: 11.5, color: '#D1FAE5' }}>Every Thursday After Maghrib · Ustadh Ahmad</div>
                  <div style={{ background: '#FFF', padding: 8, borderRadius: 12, display: 'inline-flex', marginTop: 10 }}>
                    <PhIcon name="qr-code" weight="regular" size={54} color="#103A2A" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
                    <PhIcon name="whatsapp-logo" weight="duotone" size={16} color="#186A4B" /> WhatsApp Image
                  </button>
                  <button type="button" className="qc-btn qc-btn-primary qc-btn-sm">
                    <PhIcon name="printer" weight="bold" size={15} /> A4 Print PDF
                  </button>
                </div>
              </div>
            )}

            {adminScreen === 'dailyAyah' && (
              <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>AyahPickCard — Masjid Daily Verse</div>
                <div className="qc-arabic-verse" style={{ fontSize: 19 }}>
                  وَٱصْبِرْ نَفْسَكَ مَعَ ٱلَّذِينَ يَدْعُونَ رَبَّهُم <AyahMedallion number={28} size={24} />
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>Surah Al-Kahf (18:28) · Active for Masjid Al-Noor followers</div>
                <button type="button" className="qc-btn qc-btn-emerald qc-btn-sm">
                  Set as Tomorrow&apos;s Featured Ayah
                </button>
              </div>
            )}

            {adminScreen === 'places' && (
              <div className="qc-session-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>VenueEditorScreen · Masjid Facilities</div>
                {['Wudu Area Available', 'On-Site Parking', 'Dedicated Sisters Entrance', 'Wheelchair Ramp'].map((f) => (
                  <div key={f} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{f}</span>
                    <PhIcon name="check-circle" weight="fill" size={18} color="#186A4B" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="phone-floating-dock">
            {[
              { id: 'today' as AdminScreenId, label: 'Today', icon: 'calendar-check' },
              { id: 'schedule' as AdminScreenId, label: 'Schedule', icon: 'book-open-text' },
              { id: 'postUpdate' as AdminScreenId, label: 'Updates', icon: 'megaphone' },
              { id: 'places' as AdminScreenId, label: 'Places', icon: 'mosque' },
            ].map((t) => {
              const active = adminScreen === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`phone-tab-btn ${active ? 'active' : ''}`}
                  onClick={() => setAdminScreen(t.id)}
                >
                  <PhIcon name={t.icon} weight={active ? 'fill' : 'duotone'} size={20} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT SPEC SUMMARY FOR ADMIN APP */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="clipboard-text" weight="duotone" size={20} color="#186A4B" />
              Coordinator Admin App Design Principles
            </h3>
            <span className="spec-code-tag">@qc/admin-app</span>
          </div>
          <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: 0 }}>
            Designed for Masjid coordinators standing at the prayer hall entrance right after
            Maghrib or Isha: large 46px <code>Stepper</code> buttons for one-handed headcount
            logging, 1-tap announcement templates, and instant WhatsApp/A4 QR poster generation.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="qc-badge qc-badge-emerald">ScopeSwitcher</span>
            <span className="qc-badge qc-badge-emerald">NextSessionCard</span>
            <span className="qc-badge qc-badge-emerald">Attendance Stepper</span>
            <span className="qc-badge qc-badge-emerald">AyahPickCard</span>
            <span className="qc-badge qc-badge-emerald">QR Poster Engine</span>
          </div>
        </div>
      </div>

      {/* SECTION B: DESKTOP WEB CONSOLE (ALL 9 PAGES) */}
      <div className="wb-section-header" style={{ marginTop: 16 }}>
        <div>
          <div className="wb-eyebrow">Desktop Operations Console (@qc/console)</div>
          <h2 className="wb-h1" style={{ fontSize: 22 }}>
            All 9 Web Console Pages — Interactive Workspace
          </h2>
        </div>
      </div>

      <div className="console-shell">
        <div className="console-sidebar">
          <div style={{ padding: '4px 10px 12px', borderBottom: '1px solid #E2E8F0', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#103A2A' }}>Quran Circles Console</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>National Operations · Pakistan</div>
          </div>
          {consolePages.map((pg) => (
            <button
              key={pg.id}
              type="button"
              className={`console-nav-item ${consolePage === pg.id ? 'active' : ''}`}
              onClick={() => setConsolePage(pg.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhIcon
                  name={pg.icon}
                  weight={consolePage === pg.id ? 'fill' : 'duotone'}
                  size={17}
                  color={consolePage === pg.id ? '#186A4B' : '#64748B'}
                />
                {pg.label}
              </span>
              {pg.count && (
                <span style={{ fontSize: 11, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                  {pg.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#186A4B', textTransform: 'uppercase' }}>
                apps/console/src/pages/{consolePage.charAt(0).toUpperCase() + consolePage.slice(1)}Page.tsx
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginTop: 2 }}>
                {consolePages.find((p) => p.id === consolePage)?.label}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
                <PhIcon name="funnel" weight="regular" size={14} /> Filter City: All
              </button>
              <button type="button" className="qc-btn qc-btn-primary qc-btn-sm">
                <PhIcon name="plus" weight="bold" size={14} /> New Record
              </button>
            </div>
          </div>

          {/* KPI Metric Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { l: 'Active Weekly Circles', v: '142', d: '+18 this month', ic: 'calendar-check' },
              { l: 'Dora-e-Quran Venues', v: '68', d: '12 cities', ic: 'mosque' },
              { l: 'Seat Reservations', v: '1,840', d: '94% attendance', ic: 'ticket' },
              { l: 'Verified Coordinators', v: '94', d: '100% OTP verified', ic: 'shield-check' },
            ].map((kpi) => (
              <div key={kpi.l} style={{ padding: 14, borderRadius: 16, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 11.5, fontWeight: 600 }}>
                  <span>{kpi.l}</span>
                  <PhIcon name={kpi.ic} weight="duotone" size={16} color="#186A4B" />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, margin: '4px 0 2px' }}>
                  {kpi.v}
                </div>
                <div style={{ fontSize: 11, color: '#186A4B', fontWeight: 600 }}>{kpi.d}</div>
              </div>
            ))}
          </div>

          {consolePage === 'import' ? (
            <div style={{ padding: 24, borderRadius: 18, border: '2px dashed #239B73', background: '#F3FBF7', textAlign: 'center' }}>
              <PhIcon name="file-csv" weight="duotone" size={38} color="#186A4B" />
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>
                Bulk CSV Schedule & Dora-e-Quran Importer
              </div>
              <div style={{ fontSize: 12.5, color: '#475569', margin: '4px 0 12px' }}>
                Validates bilingual English/Urdu titles, Masjid coordinates, prayer time bands, and
                Surah/Ayah portion ranges before committing.
              </div>
              <span className="qc-badge qc-badge-emerald">24 Rows Validated · 0 Schema Errors</span>
            </div>
          ) : (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
              <table className="console-table">
                <thead>
                  <tr>
                    <th>Circle / Masjid</th>
                    <th>City & Area</th>
                    <th>Schedule & Portion</th>
                    <th>Section</th>
                    <th>Capacity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700 }}>Tafseer Surah Al-Kahf</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>Jamia Masjid Al-Noor</div>
                    </td>
                    <td>Lahore · Gulberg III</td>
                    <td>
                      <div>Thu · 7:30 PM (Maghrib)</div>
                      <span className="qc-badge qc-badge-amber" style={{ marginTop: 2 }}>Al-Kahf 1–31</span>
                    </td>
                    <td><span className="qc-badge qc-badge-emerald">Brothers</span></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>18 / 40</td>
                    <td><span className="qc-badge qc-badge-emerald">Published</span></td>
                  </tr>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700 }}>Sisters Tajweed & Tadabbur</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>Jamia Fatima Zahra Hall</div>
                    </td>
                    <td>Lahore · Cavalry Ground</td>
                    <td>
                      <div>Sat · 4:45 PM (Asr)</div>
                      <span className="qc-badge qc-badge-amber" style={{ marginTop: 2 }}>Al-Mulk 1–30</span>
                    </td>
                    <td><span className="qc-badge qc-badge-info">Sisters</span></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>27 / 30</td>
                    <td><span className="qc-badge qc-badge-amber">Filling Fast</span></td>
                  </tr>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 700 }}>Nightly Dora-e-Quran</div>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>DHA Phase 4 Central Masjid</div>
                    </td>
                    <td>Lahore · DHA Phase 4</td>
                    <td>
                      <div>Daily · 9:00 PM (Isha)</div>
                      <span className="qc-badge qc-badge-amber" style={{ marginTop: 2 }}>Juz 15 · Al-Isra</span>
                    </td>
                    <td><span className="qc-badge qc-badge-neutral">Families</span></td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>112 / 150</td>
                    <td><span className="qc-badge qc-badge-emerald">Published</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
