import React, { useState } from 'react';
import { PhIcon } from './icons';

export function ArtboardsAdminManage({
  onNavigatePage,
}: {
  filter?: string;
  onNavigatePage?: (page: string) => void;
} = {}) {
  const [occStatus, setOccStatus] = useState<'Scheduled' | 'Cancelled'>('Scheduled');
  const [selectedTemplate, setSelectedTemplate] = useState('Portion Set');
  const [posterFormat, setPosterFormat] = useState<'A4 Print PDF' | 'WhatsApp Story PNG'>(
    'A4 Print PDF',
  );
  const [posterLang, setPosterLang] = useState<'English & Urdu' | 'Urdu Only'>('English & Urdu');
  const [facilities, setFacilities] = useState<Record<string, boolean>>({
    'Sisters Hall': true,
    'Wudu Area': true,
    Parking: true,
    'Wheelchair Access': true,
    'A/C Hall': true,
  });
  const [coordLang, setCoordLang] = useState<'English' | 'اردو'>('English');

  const toggleFacility = (key: string) => {
    setFacilities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const templateData: Record<string, { title: string; body: string }> = {
    'Portion Set': {
      title: 'Tonight’s Portion: Surah Al-Kahf (Ayahs 1–31)',
      body: 'Assalamu Alaikum! Ustadh Ahmad will cover Ayahs 1–31 after Maghrib (7:30 PM) in the Brothers Hall. Read the portion ahead in the app.',
    },
    'Hall Change': {
      title: 'Room Update: Moved to First Floor Air-Conditioned Hall',
      body: 'Tonight’s Tafseer Surah Al-Kahf circle will meet in the First Floor A/C Hall due to main courtyard maintenance.',
    },
    'Time Adjusted': {
      title: 'Updated Start Time: 7:45 PM After Maghrib',
      body: 'Tonight’s circle will begin 15 minutes later at 7:45 PM right after Maghrib congregation.',
    },
    'Cancelled Tonight': {
      title: 'Tonight’s Circle Cancelled — Resumes Next Week',
      body: 'Tonight’s session at Jamia Masjid Al-Noor is cancelled and will resume next week at the usual time after Maghrib.',
    },
  };

  const activeTemplate = templateData[selectedTemplate] ?? templateData['Portion Set']!;

  return (
    <div className="artboard-row">
      {/* ======================================================================
          ARTBOARD 01: 01. ScheduleScreen & Occurrence Portion Editor
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>01. ScheduleScreen &amp; Occurrence Portion Editor</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, paddingBottom: 24 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>7:52</span>
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
                cursor: 'pointer',
              }}
              onClick={() => onNavigatePage?.('admin')}
            >
              <PhIcon name="caret-left" weight="bold" size={14} /> Today
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Schedule &amp; Portions
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#1E563B' }}>Weekly</span>
          </div>

          {/* Weekly Halqa Occurrences List */}
          <div style={{ padding: '0 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Upcoming Occurrences
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  when: 'Tonight · Fri 18 Oct',
                  portion: 'Al-Kahf 1–31',
                  sub: '7:30 PM · After Maghrib',
                  active: true,
                },
                {
                  when: 'Fri 25 Oct',
                  portion: 'Al-Kahf 32–59',
                  sub: '7:30 PM · After Maghrib',
                  active: false,
                },
                {
                  when: 'Sat 19 Oct',
                  portion: 'Sisters Tajweed',
                  sub: '4:45 PM · After Asr',
                  active: false,
                },
              ].map((occ) => (
                <div
                  key={occ.when}
                  className="iq-white-card"
                  style={{
                    padding: '10px 14px',
                    border: occ.active ? '1.5px solid #10B981' : '1px solid #F1F5F9',
                    background: occ.active ? '#F3FBF7' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>
                      {occ.when} · {occ.portion}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{occ.sub}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: occ.active ? '#1E563B' : '#64748B',
                      background: occ.active ? '#D1FAE5' : '#F8FAFC',
                      padding: '3px 9px',
                      borderRadius: 999,
                    }}
                  >
                    {occ.active ? 'Editing' : 'Edit'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Occurrence Editor Card / Sheet */}
          <div style={{ padding: '0 20px', flex: 1 }}>
            <div
              className="iq-white-card"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 12px 30px -6px rgba(17, 24, 39, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#111827' }}>
                  Occurrence Portion Editor
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>
                  Tonight · Fri 18 Oct
                </span>
              </div>

              {/* Surah & Ayah Portion */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>
                  Surah &amp; Ayah Portion
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 8 }}>
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: 12,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#111827',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>18 · Al-Kahf</span>
                    <PhIcon name="caret-down" weight="bold" size={11} color="#64748B" />
                  </div>
                  <div
                    style={{
                      padding: '9px 12px',
                      borderRadius: 12,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#111827',
                      textAlign: 'center',
                    }}
                  >
                    Ayahs 1 – 31
                  </div>
                </div>
              </div>

              {/* Ustadh & Prayer Anchor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>
                    Ustadh
                  </div>
                  <div
                    style={{
                      padding: '9px 11px',
                      borderRadius: 12,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    Ustadh Ahmad
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>
                    Prayer Anchor
                  </div>
                  <div
                    style={{
                      padding: '9px 11px',
                      borderRadius: 12,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    After Maghrib · 7:30 PM
                  </div>
                </div>
              </div>

              {/* Status: Scheduled / Cancelled */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>
                  Occurrence Status
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    background: '#F8FAFC',
                    padding: 4,
                    borderRadius: 999,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {(['Scheduled', 'Cancelled'] as const).map((st) => {
                    const active = occStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setOccStatus(st)}
                        style={{
                          height: 30,
                          borderRadius: 999,
                          border: 'none',
                          background: active
                            ? st === 'Cancelled'
                              ? '#FEE2E2'
                              : '#1E563B'
                            : 'transparent',
                          color: active
                            ? st === 'Cancelled'
                              ? '#DC2626'
                              : '#FFFFFF'
                            : '#64748B',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px 0', marginTop: 'auto' }}>
            <button type="button" className="iq-pill-cta dark">
              <span>Save Occurrence &amp; Portion →</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 02: 02. PostUpdateScreen — Follower Broadcast & Templates
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>02. PostUpdateScreen — Follower Broadcast &amp; Templates</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, paddingBottom: 24 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>7:54</span>
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
              <PhIcon name="caret-left" weight="bold" size={14} /> Back
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Post Update</span>
            <span style={{ width: 36 }} />
          </div>

          {/* Scope Selector + Live Recipient Preview Badge */}
          <div style={{ padding: '0 20px', marginBottom: 14 }}>
            <div className="iq-white-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>
                Broadcast Scope
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PhIcon name="mosque" weight="duotone" size={18} color="#1E563B" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    Jamia Masjid Al-Noor · Tafseer Al-Kahf
                  </span>
                </div>
                <PhIcon name="caret-down" weight="bold" size={12} color="#64748B" />
              </div>

              <div
                style={{
                  padding: '8px 11px',
                  borderRadius: 12,
                  background: '#E8F5EE',
                  color: '#1E563B',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <PhIcon name="users-three" weight="fill" size={14} color="#1E563B" />
                <span>Reaches 42 Masjid followers + 18 tonight registrants</span>
              </div>
            </div>
          </div>

          {/* Quick Template Pills */}
          <div style={{ padding: '0 20px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
              Quick Announcement Templates
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Portion Set', 'Hall Change', 'Time Adjusted', 'Cancelled Tonight'].map((tpl) => {
                const active = selectedTemplate === tpl;
                return (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: active ? '1px solid #111827' : '1px solid #E2E8F0',
                      background: active ? '#111827' : '#FFFFFF',
                      color: active ? '#FFFFFF' : '#475569',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {tpl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Body Composer Fields */}
          <div style={{ padding: '0 20px', flex: 1 }}>
            <div className="iq-white-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B' }}>
                    Announcement Title
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1E563B' }}>
                    English &amp; اردو
                  </span>
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#F3FBF7',
                    border: '1.5px solid #10B981',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#111827',
                    lineHeight: 1.35,
                  }}
                >
                  {activeTemplate.title}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', marginBottom: 5 }}>
                  Message Body
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    fontSize: 12,
                    color: '#334155',
                    lineHeight: 1.5,
                  }}
                >
                  {activeTemplate.body}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 6,
                  borderTop: '1px solid #F1F5F9',
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 600, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PhIcon name="bell-ringing" weight="duotone" size={16} color="#1E563B" />
                  Send push notification immediately
                </span>
                <span
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 999,
                    background: '#10B981',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: 2,
                  }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF' }} />
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px 0', marginTop: 'auto' }}>
            <button type="button" className="iq-pill-cta dark">
              <PhIcon name="megaphone" weight="fill" size={16} />
              <span>Post Announcement →</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 03: 03. PostersScreen — Printable A4 & WhatsApp QR Standee
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>03. PostersScreen — Printable A4 &amp; WhatsApp QR Standee</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, paddingBottom: 24 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>7:56</span>
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
              marginBottom: 12,
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
              <PhIcon name="caret-left" weight="bold" size={14} /> Session
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Masjid QR Poster
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669' }}>Ready ✓</span>
          </div>

          {/* Format Switcher & Language Switcher */}
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                background: '#F8FAFC',
                padding: 4,
                borderRadius: 999,
                border: '1px solid #E2E8F0',
              }}
            >
              {(['A4 Print PDF', 'WhatsApp Story PNG'] as const).map((fmt) => {
                const active = posterFormat === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setPosterFormat(fmt)}
                    style={{
                      height: 30,
                      borderRadius: 999,
                      border: 'none',
                      background: active ? '#111827' : 'transparent',
                      color: active ? '#FFFFFF' : '#64748B',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                background: '#F8FAFC',
                padding: 4,
                borderRadius: 999,
                border: '1px solid #E2E8F0',
              }}
            >
              {(['English & Urdu', 'Urdu Only'] as const).map((lng) => {
                const active = posterLang === lng;
                return (
                  <button
                    key={lng}
                    type="button"
                    onClick={() => setPosterLang(lng)}
                    style={{
                      height: 28,
                      borderRadius: 999,
                      border: 'none',
                      background: active ? '#E8F5EE' : 'transparent',
                      color: active ? '#1E563B' : '#64748B',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {lng}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Framed Masjid QR Poster Preview */}
          <div style={{ padding: '0 20px', flex: 1 }}>
            <div
              style={{
                borderRadius: 24,
                overflow: 'hidden',
                background: 'linear-gradient(165deg, #1E563B 0%, #0F2E1F 100%)',
                color: '#FFFFFF',
                padding: '22px 18px',
                textAlign: 'center',
                boxShadow: '0 16px 36px rgba(15, 46, 31, 0.22)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#A7F3D0' }}>
                Jamia Masjid Al-Noor · Weekly Quran Circle
              </div>

              <div
                dir="rtl"
                lang="ur"
                style={{
                  fontFamily: 'var(--font-urdu)',
                  fontSize: 19,
                  color: '#FDE68A',
                  marginTop: 8,
                  lineHeight: 1.8,
                }}
              >
                حلقہ تفسیر سورۃ الکہف
              </div>

              {posterLang === 'English & Urdu' && (
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                  Tafseer Surah Al-Kahf
                </div>
              )}

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.86)', marginTop: 4 }}>
                Every Friday After Maghrib (7:30 PM) · Ustadh Ahmad
              </div>

              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 18,
                  padding: '14px 16px',
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 16,
                  color: '#111827',
                }}
              >
                <PhIcon name="qr-code" weight="regular" size={76} color="#111827" />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#111827' }}>
                  Scan to Reserve Free Seat &amp; Read Portion
                </span>
              </div>

              <div style={{ fontSize: 10.5, color: '#A7F3D0', marginTop: 12, fontWeight: 600 }}>
                Brothers &amp; Sisters Halls · Free Pass via SMS
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
            <button type="button" className="iq-pill-cta dark">
              <PhIcon name="file-pdf" weight="duotone" size={17} />
              <span>Download Print PDF</span>
            </button>
            <button type="button" className="iq-pill-cta">
              <PhIcon name="whatsapp-logo" weight="fill" size={16} color="#1E563B" />
              <span>Share on WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 04: 04. VenueEditorScreen & Coordinator Account
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>04. VenueEditorScreen &amp; Coordinator Account</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, paddingBottom: 24 }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>7:58</span>
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
              marginBottom: 12,
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
              Masjid &amp; Coordinator
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E563B' }}>Verified</span>
          </div>

          {/* Masjid Profile & GPS Pin Preview Card */}
          <div style={{ padding: '0 20px', marginBottom: 12 }}>
            <div className="iq-white-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    <PhIcon name="mosque" weight="duotone" size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
                      Jamia Masjid Al-Noor
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                      Main Blvd, Gulberg III, Lahore
                    </div>
                  </div>
                </div>
                <span
                  dir="rtl"
                  lang="ur"
                  style={{ fontFamily: 'var(--font-urdu)', fontSize: 13, color: '#1E563B' }}
                >
                  جامع مسجد النور
                </span>
              </div>

              {/* Compact GPS Pin Preview */}
              <div
                style={{
                  height: 74,
                  borderRadius: 14,
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #E2E8F0',
                }}
              >
                <svg width="100%" height="74" viewBox="0 0 310 74" preserveAspectRatio="xMidYMid slice">
                  <rect width="310" height="74" fill="#EFF7F3" />
                  <rect x="12" y="8" width="90" height="36" rx="8" fill="#DCEEE4" />
                  <rect x="200" y="12" width="94" height="44" rx="8" fill="#DCEEE4" />
                  <g stroke="#FFFFFF" strokeWidth="4">
                    <line x1="0" y1="38" x2="310" y2="38" />
                    <line x1="145" y1="0" x2="135" y2="74" />
                  </g>
                  <circle cx="140" cy="38" r="13" fill="#1E563B" fillOpacity="0.18" />
                  <circle cx="140" cy="38" r="6" fill="#1E563B" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    background: 'rgba(255,255,255,0.92)',
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#1E563B',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PhIcon name="map-pin" weight="fill" size={11} />
                  <span>31.5102° N, 74.3441° E</span>
                </div>
              </div>
            </div>
          </div>

          {/* Facility Toggles */}
          <div style={{ padding: '0 20px', marginBottom: 12 }}>
            <div className="iq-white-card" style={{ padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                Masjid Facilities Checklist
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { key: 'Sisters Hall', ic: 'door-open' },
                  { key: 'Wudu Area', ic: 'drop' },
                  { key: 'Parking', ic: 'car-profile' },
                  { key: 'Wheelchair Access', ic: 'wheelchair' },
                  { key: 'A/C Hall', ic: 'wind' },
                ].map((f) => {
                  const on = Boolean(facilities[f.key]);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleFacility(f.key)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: on ? '1px solid #10B981' : '1px solid #E2E8F0',
                        background: on ? '#F3FBF7' : '#F8FAFC',
                        color: on ? '#1E563B' : '#64748B',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <PhIcon
                        name={on ? 'check-circle' : f.ic}
                        weight={on ? 'fill' : 'regular'}
                        size={13}
                      />
                      <span>{f.key}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coordinator Scope & Language Settings */}
          <div style={{ padding: '0 20px', flex: 1 }}>
            <div className="iq-white-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>
                    Tariq Mehmood · Masjid Coordinator
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>
                    Scope: Jamia Masjid Al-Noor (Gulberg III)
                  </div>
                </div>
                <PhIcon name="shield-check" weight="duotone" size={18} color="#1E563B" />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px solid #F1F5F9',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                  App Language
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    background: '#F8FAFC',
                    padding: 3,
                    borderRadius: 999,
                    border: '1px solid #E2E8F0',
                    gap: 4,
                  }}
                >
                  {(['English', 'اردو'] as const).map((lng) => {
                    const active = coordLang === lng;
                    return (
                      <button
                        key={lng}
                        type="button"
                        onClick={() => setCoordLang(lng)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: 'none',
                          background: active ? '#111827' : 'transparent',
                          color: active ? '#FFFFFF' : '#64748B',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {lng}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px 0', marginTop: 'auto' }}>
            <button type="button" className="iq-pill-cta dark">
              <span>Save Venue &amp; Facilities →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
