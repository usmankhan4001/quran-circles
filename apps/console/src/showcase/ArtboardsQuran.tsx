import React from 'react';
import { PhIcon, AyahMedallion, MosqueSkylineSvg } from './icons';

export function ArtboardsQuran({
  onNavigatePage,
}: {
  onNavigatePage: (page: string) => void;
}) {
  const surahList = [
    {
      num: 1,
      name: 'Al-Fatihah',
      meaning: 'The Opener · 7 Ayahs',
      arabic: 'الفاتحة',
      saved: true,
      portion: null,
    },
    {
      num: 18,
      name: 'Al-Kahf',
      meaning: 'The Cave · 110 Ayahs',
      arabic: 'الكهف',
      saved: true,
      portion: 'Tonight · 1–31',
    },
    {
      num: 36,
      name: 'Ya-Sin',
      meaning: 'Ya Sin · 83 Ayahs',
      arabic: 'يس',
      saved: true,
      portion: 'Sat · 1–40',
    },
    {
      num: 67,
      name: 'Al-Mulk',
      meaning: 'The Sovereignty · 30 Ayahs',
      arabic: 'الملك',
      saved: false,
      portion: null,
    },
  ];

  const prayerRows = [
    { name: 'Fajr', time: '04:42 AM', circles: '1 Circle after Fajr', active: false },
    { name: 'Dhuhr', time: '12:15 PM', circles: null, active: false },
    { name: 'Asr', time: '04:35 PM', circles: '2 Sisters Circles', active: false },
    { name: 'Maghrib', time: '06:28 PM', circles: '6 Circles tonight', active: true },
    { name: 'Isha', time: '07:55 PM', circles: 'Dora-e-Quran · Juz 15', active: false },
  ];

  return (
    <div className="artboard-row">
      {/* ======================================================================
          ARTBOARD 01: QURAN INDEX — SURAHS, JUZ, BOOKMARKS & CIRCLE PORTION
          Combines Iqraa Continue Reading + 2-Col Hifz Cards + Clean Surah Index
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>01. QuranIndexScreen — Portion, Hifz &amp; Surahs</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard">
          {/* Atmospheric Emerald Header (.iq-hero-gradient) */}
          <div className="iq-hero-gradient" style={{ paddingBottom: 46 }}>
            <div className="iq-status-row">
              <span>9:41</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <PhIcon name="cell-signal-full" weight="bold" size={13} />
                <PhIcon name="wifi-high" weight="bold" size={13} />
                <PhIcon name="battery-full" weight="fill" size={15} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  Quran &amp; Portion
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.86)', marginTop: 2 }}>
                  Read along with your Masjid circle
                </div>
              </div>
              {/* Top Switcher: Quran | Waqt */}
              <div
                style={{
                  display: 'inline-flex',
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: 999,
                  padding: 3,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span
                  style={{
                    background: '#FFFFFF',
                    color: '#1E563B',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 11px',
                    borderRadius: 999,
                  }}
                >
                  Quran
                </span>
                <span
                  style={{
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 11px',
                  }}
                >
                  Waqt
                </span>
              </div>
            </div>
          </div>

          {/* Tonight's Circle Portion Hero Card (Overlapping Emerald Header) */}
          <div style={{ padding: '0 20px', marginTop: -34, position: 'relative', zIndex: 5 }}>
            <div
              className="iq-white-card"
              style={{
                padding: '15px 16px',
                boxShadow: '0 12px 32px -4px rgba(17, 24, 39, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1E563B', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                  Tonight&apos;s Circle Portion · 7:30 PM
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>12 / 31 Read</span>
              </div>

              <div className="iq-card-top-row" style={{ alignItems: 'center' }}>
                <div>
                  <div className="iq-card-title" style={{ fontSize: 15.5 }}>
                    Surah Al-Kahf : 1–31
                  </div>
                  <div className="iq-card-sub">
                    Jamia Masjid Al-Noor · Stopped at Ayah 12
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-quran)',
                    fontSize: 20,
                    color: '#111827',
                    lineHeight: 1.2,
                  }}
                >
                  الكهف
                </div>
              </div>

              {/* Clean Single-Line Verse Preview with Medallion */}
              <div className="iq-arabic-display" style={{ fontSize: 19, margin: '10px 0 4px' }}>
                <AyahMedallion number={12} size={24} /> نَحْنُ نَقُصُّ عَلَيْكَ نَبَأَهُم بِٱلْحَقِّ
              </div>

              <button type="button" className="iq-pill-cta" style={{ height: 36, fontSize: 12, marginTop: 8 }}>
                Continue Portion (Ayah 13) <span>→</span>
              </button>
            </div>
          </div>

          {/* Hifz & Memorisation 2-Col Cards (Exact Iqraa Screenshot 1 & 3 Hifz Section) */}
          <div className="iq-section" style={{ paddingTop: 14 }}>
            <div className="iq-section-head" style={{ marginBottom: 8 }}>
              <span className="iq-section-title" style={{ fontSize: 15 }}>Hifz &amp; Revision</span>
              <button type="button" className="iq-see-more">
                14 Memorised <PhIcon name="caret-right" weight="bold" size={11} />
              </button>
            </div>

            <div className="iq-two-col">
              <div className="iq-mini-card" style={{ padding: 12, gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>Al-Kahf : 10</span>
                  <span style={{ fontFamily: 'var(--font-quran)', fontSize: 14, color: '#64748B' }}>الكهف</span>
                </div>
                <div style={{ fontFamily: 'var(--font-quran)', fontSize: 17, textAlign: 'center', color: '#111827', margin: '2px 0' }}>
                  إِذْ أَوَى ٱلْفِتْيَةُ
                </div>
                <button type="button" className="iq-pill-cta" style={{ height: 30, fontSize: 11 }}>
                  Continue <span>→</span>
                </button>
              </div>

              <div className="iq-mini-card" style={{ padding: 12, gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>Al-Mulk : 30</span>
                  <span style={{ fontFamily: 'var(--font-quran)', fontSize: 14, color: '#64748B' }}>الملك</span>
                </div>
                <div style={{ fontFamily: 'var(--font-quran)', fontSize: 17, textAlign: 'center', color: '#111827', margin: '2px 0' }}>
                  تَبَـٰرَكَ ٱلَّذِى
                </div>
                <button type="button" className="iq-pill-cta" style={{ height: 30, fontSize: 11 }}>
                  Continue <span>→</span>
                </button>
              </div>
            </div>
          </div>

          {/* Segmented Tabs: Surahs | Juz | Bookmarks */}
          <div style={{ padding: '14px 20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 999, padding: 3 }}>
                <span style={{ background: '#FFFFFF', color: '#111827', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  Surahs (114)
                </span>
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600, padding: '4px 11px' }}>
                  Juz (30)
                </span>
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600, padding: '4px 11px' }}>
                  Saved (6)
                </span>
              </div>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                }}
              >
                <PhIcon name="magnifying-glass" weight="bold" size={13} />
              </div>
            </div>

            {/* Clean Surah Rows with StarNumber + Calligraphic Right Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {surahList.map((s) => (
                <div
                  key={s.num}
                  className="iq-white-card"
                  style={{
                    padding: '9px 12px',
                    borderRadius: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AyahMedallion number={s.num} size={26} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{s.name}</span>
                        {s.portion && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              color: '#047857',
                              background: '#ECFDF5',
                              padding: '1px 6px',
                              borderRadius: 999,
                            }}
                          >
                            {s.portion}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748B' }}>{s.meaning}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-quran)',
                        fontSize: 17,
                        color: '#111827',
                      }}
                    >
                      {s.arabic}
                    </span>
                    {s.saved && (
                      <PhIcon name="check-circle" weight="fill" size={14} color="#10B981" />
                    )}
                  </div>
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
            <button type="button" className="iq-nav-icon-btn active">
              <PhIcon name="book-open" weight="fill" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn" onClick={() => onNavigatePage('session')}>
              <PhIcon name="bookmarks" weight="regular" size={20} />
            </button>
            <button type="button" className="iq-nav-icon-btn">
              <PhIcon name="user-circle" weight="regular" size={20} />
            </button>
          </nav>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 02: QURANREADERSCREEN — EXACT IQRAA SCREENSHOT 3 READER + CIRCLE PORTION
          Pure White Cards + Medallion at End of Arabic + Mark Check + Floating Reciter Pill
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>02. QuranReaderScreen — Tonight&apos;s Portion &amp; Audio</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ paddingTop: 14, background: '#FAFAFA' }}>
          <div className="iq-status-row" style={{ padding: '0 20px', color: '#111827', marginBottom: 12 }}>
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <PhIcon name="cell-signal-full" weight="bold" size={13} />
              <PhIcon name="wifi-high" weight="bold" size={13} />
              <PhIcon name="battery-full" weight="fill" size={15} />
            </div>
          </div>

          {/* Exact Iqraa Screenshot 3 Top Bar: Back on Left, Search + Sun + Sliders on Right */}
          <div style={{ padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => onNavigatePage('home')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#111827', padding: 0 }}
            >
              <PhIcon name="caret-left" weight="bold" size={16} />
            </button>
            <div style={{ display: 'flex', gap: 16, color: '#475569' }}>
              <PhIcon name="magnifying-glass" weight="regular" size={17} />
              <PhIcon name="sun" weight="regular" size={17} />
              <PhIcon name="sliders-horizontal" weight="regular" size={17} />
            </div>
          </div>

          {/* Horizontal Surah Tab Strip (Exact Iqraa Screenshot 3 Style) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 20px 10px',
              borderBottom: '1px solid #F1F5F9',
              fontSize: 13,
              fontWeight: 600,
              color: '#94A3B8',
            }}
          >
            <span>Al-Isra</span>
            <span>Al-Anbiya</span>
            <span>Maryam</span>
            <span style={{ color: '#10B981', fontWeight: 700, borderBottom: '2px solid #10B981', paddingBottom: 8, marginBottom: -11 }}>
              Al-Kahf
            </span>
          </div>

          {/* Surah Subheader + Circle Portion Pill (Exact Iqraa Screenshot 3 Proportions) */}
          <div style={{ padding: '14px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: '#111827' }}>
              Al-Kahf (Portion 1–31)
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#047857', background: '#ECFDF5', padding: '4px 9px', borderRadius: 6 }}>
                Masjid Al-Noor
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '4px 9px', borderRadius: 6 }}>
                Makkiyah
              </span>
            </div>
          </div>

          {/* Verse Cards (Exact Iqraa Screenshot 3 Layout — Clean White Cards, Zero Heavy Green Borders) */}
          <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Verse 1 */}
            <div className="iq-white-card" style={{ padding: '16px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <AyahMedallion number={1} size={26} />
                <span
                  style={{
                    fontFamily: 'var(--font-quran)',
                    fontSize: 21,
                    lineHeight: 1.75,
                    color: '#111827',
                    direction: 'rtl',
                  }}
                >
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                </span>
              </div>

              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
                Bismi Allahi arrahmani arraheem
              </div>

              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
                In the Name of Allah—the Most Compassionate, Most Merciful.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <PhIcon name="check-circle" weight="fill" size={16} color="#10B981" /> Mark
                </span>
                <PhIcon name="minus-square" weight="regular" size={17} color="#64748B" />
              </div>
            </div>

            {/* Verse 2 */}
            <div className="iq-white-card" style={{ padding: '16px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <AyahMedallion number={2} size={26} />
                <span
                  style={{
                    fontFamily: 'var(--font-quran)',
                    fontSize: 21,
                    lineHeight: 1.75,
                    color: '#111827',
                    direction: 'rtl',
                  }}
                >
                  ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ عَلَىٰ عَبْدِهِ ٱلْكِتَـٰبَ
                </span>
              </div>

              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
                Alhamdu lillahi allathee anzala &apos;ala &apos;abdihi al-kitaba
              </div>

              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
                All praise is due to Allah, who has sent down upon His Servant the Book and has not
                made therein any deviance.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <PhIcon name="check-circle" weight="fill" size={16} color="#10B981" /> Mark
                </span>
                <PhIcon name="minus-square" weight="regular" size={17} color="#64748B" />
              </div>
            </div>

            {/* Verse 3 (Peeking Behind Floating Reciter Pill — Exact Iqraa Screenshot 3) */}
            <div className="iq-white-card" style={{ padding: '16px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <AyahMedallion number={3} size={26} />
                <span
                  style={{
                    fontFamily: 'var(--font-quran)',
                    fontSize: 21,
                    lineHeight: 1.75,
                    color: '#111827',
                    direction: 'rtl',
                  }}
                >
                  قَيِّمًا لِّيُنذِرَ بَأْسًا شَدِيدًا مِّن لَّدُنْهُ
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                Qayyiman liyunthira ba&apos;san shadeedan min ladunhu
              </div>
            </div>
          </div>

          {/* Floating White Reciter Pill (Exact Iqraa Screenshot 3 Bottom-Right Phone) */}
          <div
            style={{
              position: 'absolute',
              bottom: 22,
              left: 28,
              right: 28,
              height: 50,
              background: '#FFFFFF',
              borderRadius: 999,
              boxShadow: '0 12px 32px rgba(17, 24, 39, 0.14)',
              border: '1px solid #F1F5F9',
              padding: '0 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PhIcon name="caret-up" weight="bold" size={13} color="#64748B" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>
                Abdurrahman As-Sudais
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PhIcon name="repeat" weight="regular" size={15} color="#64748B" />
              <PhIcon name="play-circle" weight="regular" size={22} color="#111827" />
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 03: READER SETTINGS, BILINGUAL URDU/ENGLISH & JUMP SHEET
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>03. Reader Settings, Urdu Translation &amp; Jump Sheet</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ background: '#475569' }}>
          {/* Dimmed Reader Preview Behind Sheet showing Urdu Nastaliq Verse */}
          <div style={{ padding: '14px 20px', opacity: 0.48, background: '#FAFAFA', height: 290 }}>
            <div className="iq-status-row" style={{ color: '#111827', marginBottom: 10 }}>
              <span>9:41</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <PhIcon name="cell-signal-full" weight="bold" size={13} />
                <PhIcon name="wifi-high" weight="bold" size={13} />
                <PhIcon name="battery-full" weight="fill" size={15} />
              </div>
            </div>

            <div className="iq-white-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                <AyahMedallion number={1} size={24} />
                <span style={{ fontFamily: 'var(--font-quran)', fontSize: 20, color: '#111827', direction: 'rtl' }}>
                  ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ عَلَىٰ عَبْدِهِ ٱلْكِتَـٰبَ
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-urdu)',
                  fontSize: 15,
                  lineHeight: 2.1,
                  textAlign: 'right',
                  direction: 'rtl',
                  color: '#334155',
                }}
              >
                تعریف اللہ ہی کے لیے ہے جس نے اپنے بندے پر یہ کتاب نازل کی اور اس میں کوئی ٹیڑھ نہیں رکھی۔
              </div>
            </div>
          </div>

          {/* Reader Settings & Jump Bottom Sheet */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 555,
              background: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: '12px 20px 24px',
              boxShadow: '0 -12px 32px rgba(0,0,0,0.16)',
            }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 99, background: '#E2E8F0', margin: '0 auto 14px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Reader &amp; Portion Settings</span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PhIcon name="x" weight="bold" size={13} color="#475569" />
              </div>
            </div>

            {/* Arabic Zoom Stepper (5 Steps from packages/content/src/quran/prefs.ts) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Arabic Script Size</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#10B981' }}>Step 3 of 5 (115%)</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '8px 12px',
                }}
              >
                <button
                  type="button"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#111827',
                  }}
                >
                  A−
                </button>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div
                      key={step}
                      style={{
                        width: step === 3 ? 12 : 8,
                        height: step === 3 ? 12 : 8,
                        borderRadius: '50%',
                        background: step <= 3 ? '#10B981' : '#CBD5E1',
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#111827',
                  }}
                >
                  A+
                </button>
              </div>
            </div>

            {/* Translation Language Selector (Maududi Urdu / English / Both) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                Translation (Tafheem-ul-Quran · Maududi)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'English', active: true },
                  { label: 'اردو (Urdu)', active: false },
                  { label: 'Arabic Only', active: false },
                ].map((opt) => (
                  <span
                    key={opt.label}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '9px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: opt.active ? '#ECFDF5' : '#F8FAFC',
                      color: opt.active ? '#047857' : '#475569',
                      border: opt.active ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                    }}
                  >
                    {opt.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Jump to Circle Portion or Ayah */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                Jump to Ayah or Circle Milestone
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: '18:1 · Start of Portion', active: true },
                  { label: '18:10 · Dua of the Cave', active: false },
                  { label: '18:13 · My Last Mark', active: false },
                  { label: '18:31 · End of Portion', active: false },
                ].map((j) => (
                  <span
                    key={j.label}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: j.active ? '#111827' : '#F8FAFC',
                      color: j.active ? '#FFFFFF' : '#475569',
                      border: j.active ? '1px solid #111827' : '1px solid #E2E8F0',
                    }}
                  >
                    {j.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Offline Surah Download Toggle */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: '#F8FAFC',
                border: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PhIcon name="cloud-check" weight="fill" size={18} color="#10B981" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>Saved for Offline in Masjid</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Surah Al-Kahf text &amp; translation cached</div>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>Saved</span>
            </div>

            <button type="button" className="iq-pill-cta dark">
              Apply &amp; Return to Portion
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================
          ARTBOARD 04: PRAYER TIMES, WAQT CIRCLES & MASJID UPDATES
         ====================================================================== */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>04. Prayer &amp; Post-Prayer Circle Schedule</span>
          <span>375 × 812</span>
        </div>

        <div className="ios-artboard" style={{ background: '#FAFAFA', paddingBottom: 32 }}>
          <div
            style={{
              background: '#FFFFFF',
              padding: '14px 20px 22px',
              position: 'relative',
              overflow: 'hidden',
              borderBottom: '1px solid #F1F5F9',
            }}
          >
            <div className="iq-status-row" style={{ color: '#111827' }}>
              <span>9:41</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <PhIcon name="cell-signal-full" weight="bold" size={13} />
                <PhIcon name="wifi-high" weight="bold" size={13} />
                <PhIcon name="battery-full" weight="fill" size={15} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhIcon name="caret-left" weight="bold" size={16} color="#111827" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  Prayer &amp; Circle Schedule
                </span>
              </div>
              <PhIcon name="gear" weight="regular" size={18} color="#64748B" />
            </div>

            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ fontSize: 11.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <PhIcon name="calendar-blank" weight="regular" size={13} />
                <span>Today, 14 Ramadan 1447 · Lahore</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
                Maghrib 6:28 PM
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#10B981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <PhIcon name="hourglass-medium" weight="regular" size={13} />
                <span>0:24:15 until adhan · 6 Circles after</span>
              </div>
            </div>

            <div style={{ position: 'absolute', right: -30, bottom: -6, width: 220, height: 95, pointerEvents: 'none' }}>
              <MosqueSkylineSvg />
            </div>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {prayerRows.map((row) => (
              <div
                key={row.name}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  padding: '13px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: row.active ? '1.5px solid #10B981' : '1px solid #F1F5F9',
                  boxShadow: '0 2px 10px rgba(17, 24, 39, 0.02)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{row.name}</div>
                  {row.circles && (
                    <div
                      style={{
                        fontSize: 11,
                        color: row.active ? '#059669' : '#64748B',
                        fontWeight: row.active ? 600 : 500,
                        marginTop: 2,
                      }}
                    >
                      {row.circles}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                    {row.time}
                  </span>
                  <PhIcon
                    name="speaker-high"
                    weight={row.active ? 'fill' : 'regular'}
                    size={16}
                    color={row.active ? '#10B981' : '#94A3B8'}
                  />
                </div>
              </div>
            ))}

            {/* Coordinator Portion Update Card Below Prayer List */}
            <div className="iq-white-card" style={{ padding: 14, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1E563B', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                  Jamia Masjid Al-Noor Update
                </span>
                <span style={{ fontSize: 10.5, color: '#94A3B8' }}>35m ago</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Tonight’s Portion Set: Surah Al-Kahf 1–31
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                First Floor Eastern Hall right after Maghrib sunnah.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
