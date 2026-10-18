import React, { useState } from 'react';
import {
  PhIcon,
  PHOSPHOR_ICON_CATALOG,
  type PhWeight,
  AyahMedallion,
  MosqueSkylineSvg,
  GirihWatermarkSvg,
  VenueArchArtSvg,
} from './icons';

export function TabFoundationsAndIcons() {
  const [selectedWeight, setSelectedWeight] = useState<PhWeight>('duotone');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = [
    'All',
    'Navigation',
    'Quran & Worship',
    'Circles & Venues',
    'Facilities',
    'Actions & Status',
    'Admin & Console',
  ];

  const filteredIcons =
    selectedCategory === 'All'
      ? PHOSPHOR_ICON_CATALOG
      : PHOSPHOR_ICON_CATALOG.filter((i) => i.category === selectedCategory);

  const emeraldSwatches = [
    { name: 'Canvas Whisper', hex: '#F8FAFC', token: 'colors.background' },
    { name: 'Pure Surface', hex: '#FFFFFF', token: 'colors.surface' },
    { name: 'Emerald 50', hex: '#F3FBF7', token: 'colors.accentSubtle' },
    { name: 'Emerald 100', hex: '#E1F5EC', token: 'colors.accentBorder' },
    { name: 'Emerald 500', hex: '#239B73', token: 'colors.accentLight' },
    { name: 'Emerald 700', hex: '#186A4B', token: 'colors.accent (Primary)' },
    { name: 'Emerald 900', hex: '#103A2A', token: 'colors.heroDeep' },
    { name: 'Charcoal CTA', hex: '#111827', token: 'colors.buttonPrimary' },
  ];

  const amberAndStatusSwatches = [
    { name: 'Amber 50', hex: '#FFF8EB', token: 'colors.warningSubtle' },
    { name: 'Amber 100', hex: '#FFF3E0', token: 'colors.portionChip' },
    { name: 'Amber 400', hex: '#FFB04D', token: 'colors.goldAccent' },
    { name: 'Amber 500', hex: '#F5820B', token: 'colors.warning' },
    { name: 'Ink Secondary', hex: '#475569', token: 'colors.textSecondary' },
    { name: 'Border Crisp', hex: '#E2E8F0', token: 'colors.border' },
    { name: 'Danger 600', hex: '#DC2626', token: 'colors.danger' },
    { name: 'Info 600', hex: '#2563EB', token: 'colors.info' },
  ];

  return (
    <div>
      <div className="wb-section-header">
        <div>
          <div className="wb-eyebrow">
            Part 1 · Foundations, Tri-Script Typography & Phosphor Icons
          </div>
          <h1 className="wb-h1">Design Tokens & Phosphor Icon Architecture</h1>
          <p className="wb-desc">
            Replacing all ad-hoc SVG paths with <strong>Phosphor Icons v2.1.1</strong> across{' '}
            <code>duotone</code>, <code>regular</code>, <code>fill</code>, and <code>bold</code>{' '}
            weights, paired with the Pure Iqraa surface system and Al-Maktaba Al-Shamela deep
            emerald hierarchy.
          </p>
        </div>
      </div>

      {/* Color System */}
      <div className="spec-grid-2">
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="palette" weight="duotone" size={20} color="#186A4B" />
              Surface & Primary Emerald Ramp
            </h3>
            <span className="spec-code-tag">@qc/ui tokens.colors</span>
          </div>
          <div className="swatch-grid">
            {emeraldSwatches.map((s) => (
              <div key={s.name} className="swatch-card">
                <div
                  className="swatch-color"
                  style={{
                    background: s.hex,
                    borderBottom: s.hex === '#FFFFFF' ? '1px solid #E2E8F0' : 'none',
                  }}
                />
                <div className="swatch-meta">
                  <div className="swatch-name">{s.name}</div>
                  <div className="swatch-hex">{s.hex}</div>
                  <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{s.token}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="spec-grid-1" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="spec-panel">
            <div className="spec-panel-head">
              <h3 className="spec-panel-title">
                <PhIcon name="sun-horizon" weight="duotone" size={20} color="#F5820B" />
                Warm Amber (Portions / Dora-e-Quran) & Semantic Ink
              </h3>
              <span className="spec-code-tag">Secondary & Status</span>
            </div>
            <div className="swatch-grid">
              {amberAndStatusSwatches.map((s) => (
                <div key={s.name} className="swatch-card">
                  <div className="swatch-color" style={{ background: s.hex }} />
                  <div className="swatch-meta">
                    <div className="swatch-name">{s.name}</div>
                    <div className="swatch-hex">{s.hex}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{s.token}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Phosphor Icons Interactive Matrix */}
      <div className="spec-panel" style={{ marginBottom: 24 }}>
        <div className="spec-panel-head" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="spec-panel-title">
              <PhIcon name="sparkle" weight="duotone" size={20} color="#186A4B" />
              Phosphor Icons Library Mapping — All 36 <code>@qc/ui</code> Icon Tokens
            </h3>
            <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
              Rule: <strong>Duotone</strong> for feature tiles, section badges, prayer waqts & empty
              states · <strong>Regular (1.5px)</strong> for inline metadata & buttons ·{' '}
              <strong>Fill</strong> for active bottom tabs & verified badges.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="qc-segmented">
              {(['duotone', 'regular', 'fill', 'bold'] as PhWeight[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`qc-seg-btn ${selectedWeight === w ? 'active' : ''}`}
                  onClick={() => setSelectedWeight(w)}
                >
                  {w.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`qc-chip ${selectedCategory === cat ? 'selected' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Icon Catalog Grid */}
        <div className="ph-catalog-grid">
          {filteredIcons.map((item) => (
            <div key={item.qcToken} className="ph-catalog-item">
              <div className="ph-catalog-icon-box">
                <PhIcon name={item.phSlug} weight={selectedWeight} size={22} color="#186A4B" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>
                    {item.qcToken}
                  </span>
                  <code
                    style={{
                      fontSize: 10,
                      background: '#E2E8F0',
                      padding: '1px 5px',
                      borderRadius: 4,
                      color: '#334155',
                    }}
                  >
                    ph-{item.phSlug}
                  </code>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#64748B',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={item.usage}
                >
                  {item.usage}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tri-Script Typography + Bespoke Cultural Artwork */}
      <div className="spec-grid-2">
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="text-aa" weight="duotone" size={20} color="#186A4B" />
              Tri-Script Typography System (Latin + Uthmani Arabic + Nastaliq Urdu)
            </h3>
            <span className="spec-code-tag">@qc/ui Text variants</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: '#F8FAFC',
                border: '1px solid #EDF2F7',
              }}
            >
              <div className="spec-sublabel">1. Latin UI & Display (Plus Jakarta Sans + Inter)</div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#111827',
                  marginTop: 4,
                }}
              >
                Tafseer Surah Al-Kahf · 7:30 PM
              </div>
              <div style={{ fontSize: 13.5, color: '#475569', marginTop: 4 }}>
                Tabular numerals (<code>font-variant-numeric: tabular-nums</code>) keep prayer
                countdowns, seat meters, and clock figures perfectly aligned.
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: '#FFFDF9',
                border: '1px solid #FDE2B8',
              }}
            >
              <div className="spec-sublabel">
                2. Quranic Uthmani Script (Amiri Quran · lineHeight 2.05 · StarNumber Medallion)
              </div>
              <div className="qc-arabic-verse" style={{ marginTop: 6 }}>
                إِنَّ ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّـٰلِحَـٰتِ كَانَتْ لَهُمْ جَنَّـٰتُ
                ٱلْفِرْدَوْسِ نُزُلًا <AyahMedallion number={107} size={28} />
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: '#F3FBF7',
                border: '1px solid #BFE8D6',
              }}
            >
              <div className="spec-sublabel">
                3. Urdu Nastaliq Script (Noto Nastaliq Urdu · lineHeight 2.1 · Zero Nuqta Clipping)
              </div>
              <div
                className="qc-urdu-text"
                style={{ fontSize: 16, color: '#111827', marginTop: 6, textAlign: 'right' }}
              >
                ہفتہ وار حلقہ تفسیر القرآن — بعد نماز مغرب، جامع مسجد النور گلبرگ
              </div>
            </div>
          </div>
        </div>

        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="mosque" weight="duotone" size={20} color="#186A4B" />
              Cultural & Architectural Vector Motifs (Non-Icon Artworks)
            </h3>
            <span className="spec-code-tag">4 Dedicated Art Pieces</span>
          </div>

          <div className="spec-sublabel">
            A. Iqraa 1px Mosque Skyline Header Mist (HeroHeader Background)
          </div>
          <div
            style={{
              position: 'relative',
              height: 92,
              borderRadius: 16,
              background: 'linear-gradient(180deg, #DCF4E9 0%, #F8FAFC 100%)',
              border: '1px solid #BFE8D6',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              padding: '0 18px',
            }}
          >
            <div style={{ zIndex: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#186A4B' }}>
                14 RAMADAN 1447 AH · LAHORE
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
                Whisper-thin architectural horizon
              </div>
            </div>
            <MosqueSkylineSvg className="phone-mist-skyline" />
          </div>

          <div className="spec-sublabel">
            B. Upgraded VenueArt for PictureCard (4 Deterministic Masjid Seeds)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {['masjid-noor', 'jamia-ashrafia', 'badshahi-hall', 'dha-masjid'].map((seed) => (
              <div
                key={seed}
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #E2E8F0',
                }}
              >
                <VenueArchArtSvg seed={seed} height={68} />
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '4px 6px',
                    textAlign: 'center',
                    background: '#FFF',
                  }}
                >
                  {seed}
                </div>
              </div>
            ))}
          </div>

          <div className="spec-sublabel">
            C. Al-Shamela Girih Corner Rosette + Rub el Hizb StarNumber Medallions
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AyahMedallion number={1} size={32} />
              <AyahMedallion number={18} size={32} />
              <AyahMedallion number={255} size={34} />
              <AyahMedallion number="٢٨٦" size={34} />
            </div>
            <div
              style={{
                position: 'relative',
                width: 150,
                height: 52,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #1F684B, #103A2A)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
                color: '#FFF',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Girih Watermark
              <div
                style={{
                  position: 'absolute',
                  right: -25,
                  top: -25,
                  width: 90,
                  height: 90,
                  opacity: 0.18,
                }}
              >
                <GirihWatermarkSvg />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
