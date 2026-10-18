import React from 'react';
import { PhIcon, AyahMedallion } from './icons';

export function ArtboardsComponents() {
  const greenScale = [
    { label: 'Emerald 50', hex: '#E8F5EE', text: '#111827' },
    { label: 'Emerald 200', hex: '#A7F3D0', text: '#111827' },
    { label: 'Emerald 400', hex: '#34D399', text: '#111827' },
    { label: 'Emerald 600', hex: '#10B981', text: '#FFFFFF' },
    { label: 'Emerald 700', hex: '#327A56', text: '#FFFFFF' },
    { label: 'Emerald 900', hex: '#1E563B', text: '#FFFFFF' },
  ];

  const amberScale = [
    { label: 'Amber 50', hex: '#FFFBEB', text: '#111827' },
    { label: 'Amber 100', hex: '#FEF3C7', text: '#111827' },
    { label: 'Amber 300', hex: '#FCD34D', text: '#111827' },
    { label: 'Amber 500', hex: '#F59E0B', text: '#FFFFFF' },
    { label: 'Amber 700', hex: '#B45309', text: '#FFFFFF' },
    { label: 'Charcoal 900', hex: '#111827', text: '#FFFFFF' },
  ];

  return (
    <div className="artboard-row">
      {/* SHEET 1: COLOR PALETTE & TRI-SCRIPT TYPOGRAPHY (Matches Iqraa Screenshot 4 Center Sheet) */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>Style Guide 01 — Colors & Tri-Script Typography</span>
          <span>520 × 812</span>
        </div>

        <div
          className="ios-artboard"
          style={{ width: 520, borderRadius: 24, padding: 28 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
              Quran Circles · Design System
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>@qc/ui tokens</span>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Color Styles</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              Forest emerald for Masjids & circles, warm amber for Quran portions & Ramadan Dora,
              and pure white surfaces.
            </div>
          </div>

          {/* Primary Emerald Grid */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginTop: 18, marginBottom: 8 }}>
            Primary Emerald
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderRadius: 14, overflow: 'hidden', border: '1px solid #F1F5F9' }}>
            {greenScale.map((s) => (
              <div
                key={s.label}
                style={{
                  background: s.hex,
                  color: s.text,
                  height: 78,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>{s.label}</span>
                <span style={{ fontSize: 10, opacity: 0.85, fontFamily: 'monospace' }}>{s.hex}</span>
              </div>
            ))}
          </div>

          {/* Secondary Amber & Ink Grid */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginTop: 16, marginBottom: 8 }}>
            Secondary Portion Amber & Charcoal CTA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderRadius: 14, overflow: 'hidden', border: '1px solid #F1F5F9' }}>
            {amberScale.map((s) => (
              <div
                key={s.label}
                style={{
                  background: s.hex,
                  color: s.text,
                  height: 78,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>{s.label}</span>
                <span style={{ fontSize: 10, opacity: 0.85, fontFamily: 'monospace' }}>{s.hex}</span>
              </div>
            ))}
          </div>

          {/* Tri-Script Typography */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginTop: 20, marginBottom: 10 }}>
            Tri-Script Typography (Plus Jakarta Sans · Amiri Quran · Nastaliq)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFC' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>
                Tafseer Surah Al-Kahf · 7:30 PM
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Jamia Masjid Al-Noor, Gulberg III · 22 seats available
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFC', textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-quran)', fontSize: 20, color: '#111827' }}>
                وَٱصْبِرْ نَفْسَكَ مَعَ ٱلَّذِينَ يَدْعُونَ رَبَّهُم <AyahMedallion number={28} size={26} />
              </div>
              <div style={{ fontFamily: 'var(--font-urdu)', fontSize: 14, color: '#475569', marginTop: 4 }}>
                ہفتہ وار حلقہ تفسیر القرآن — بعد نماز مغرب، جامع مسجد النور
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SHEET 2: @qc/ui INTERACTIVE COMPONENTS & PHOSPHOR ICONS (Matches Iqraa Screenshot 4 Left Sheet) */}
      <div className="artboard-col">
        <div className="artboard-caption">
          <span>Style Guide 02 — @qc/ui Components & Phosphor Icons</span>
          <span>520 × 812</span>
        </div>

        <div
          className="ios-artboard"
          style={{ width: 520, borderRadius: 24, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
              Components & Phosphor Icons
            </span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>31 Exports</span>
          </div>

          {/* Buttons */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Pill Buttons (Primary Dark, Primary Emerald, Outlined In-Card, Destructive)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" className="iq-pill-cta dark" style={{ height: 42 }}>
                Reserve Free Seat →
              </button>
              <button
                type="button"
                className="iq-pill-cta"
                style={{ height: 42, background: '#1E563B', color: '#FFFFFF', borderColor: '#1E563B' }}
              >
                <PhIcon name="book-open" weight="fill" size={14} /> Open Portion
              </button>
              <button type="button" className="iq-pill-cta" style={{ height: 40 }}>
                Continue <PhIcon name="arrow-right" weight="regular" size={13} />
              </button>
              <button
                type="button"
                className="iq-pill-cta"
                style={{ height: 40, color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}
              >
                Release Seat
              </button>
            </div>
          </div>

          {/* Inputs & Search */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              TextField & SearchField Pills (Focused & Default)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: '#F3FBF7',
                  border: '1.5px solid #10B981',
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                <PhIcon name="user" weight="fill" size={15} color="#1E563B" />
                <span>Usman Khan</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: 12.5,
                  color: '#64748B',
                }}
              >
                <PhIcon name="magnifying-glass" weight="regular" size={15} />
                <span>Search masjid or area…</span>
              </div>
            </div>
          </div>

          {/* SeatMeter States */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              SeatMeter Capacity Bars (Available · Filling Fast · Waitlist)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 16, background: '#F8FAFC' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#059669' }}>22 seats available</span>
                  <span style={{ color: '#64748B' }}>18 / 40</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#E2E8F0' }}>
                  <div style={{ width: '45%', height: '100%', borderRadius: 999, background: '#10B981' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: '#D97706' }}>Filling fast · 3 seats left</span>
                  <span style={{ color: '#64748B' }}>27 / 30</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: '#E2E8F0' }}>
                  <div style={{ width: '90%', height: '100%', borderRadius: 999, background: '#F59E0B' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Phosphor Icons Grid */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Phosphor Icons (@phosphor-icons/web · Duotone & Regular)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {[
                { ic: 'mosque', l: 'Masjid' },
                { ic: 'book-open-text', l: 'Portion' },
                { ic: 'compass', l: 'Nearby' },
                { ic: 'map-pin', l: 'Venue' },
                { ic: 'ticket', l: 'Seat Pass' },
                { ic: 'users-three', l: 'Halqa' },
                { ic: 'sun-horizon', l: 'Maghrib' },
                { ic: 'moon-stars', l: 'Dora' },
                { ic: 'drop', l: 'Wudu' },
                { ic: 'car-profile', l: 'Parking' },
                { ic: 'wheelchair', l: 'Access' },
                { ic: 'qr-code', l: 'Poster' },
              ].map((item) => (
                <div
                  key={item.l}
                  style={{
                    padding: '10px 4px',
                    borderRadius: 12,
                    background: '#F8FAFC',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PhIcon name={item.ic} weight="duotone" size={20} color="#1E563B" />
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>{item.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
