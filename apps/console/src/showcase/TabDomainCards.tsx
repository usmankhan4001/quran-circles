import React, { useState } from 'react';
import { PhIcon, GirihWatermarkSvg, VenueArchArtSvg, AyahMedallion } from './icons';

export function TabDomainCards() {
  const [nextState, setNextState] = useState<'registered' | 'nearby' | 'dora' | 'live'>('registered');
  const [readTodayDone, setReadTodayDone] = useState(false);
  const [goalMetDone, setGoalMetDone] = useState(false);

  const picturePlaces = [
    {
      seed: 'masjid-noor',
      title: 'Tafseer Surah Al-Kahf',
      venue: 'Masjid Al-Noor · Thu 7:30 PM',
      distance: '0.8 km',
      section: 'Brothers',
      sectionIcon: 'user',
    },
    {
      seed: 'jamia-fatima',
      title: 'Sisters Tajweed & Tadabbur',
      venue: 'Jamia Fatima Hall · Sat 4:45 PM',
      distance: '1.4 km',
      section: 'Sisters',
      sectionIcon: 'sparkle',
    },
    {
      seed: 'dha-central',
      title: 'Dora-e-Quran Juz 14',
      venue: 'DHA Phase 4 Masjid · Daily 9:00 PM',
      distance: '2.1 km',
      section: 'Families',
      sectionIcon: 'users-four',
    },
  ];

  return (
    <div>
      <div className="wb-section-header">
        <div>
          <div className="wb-eyebrow">Part 3 · Domain Cards Deep Lab (All 12 Feature Cards)</div>
          <h1 className="wb-h1">Every Domain Card & Interactive State Across User & Admin Apps</h1>
          <p className="wb-desc">
            Inspecting all 12 domain-specific cards from <code>apps/user-app/src/components/</code>{' '}
            and <code>apps/user-app/src/ui/</code> with live state toggles—including replacing the
            rotated-rectangle <code>MapPreviewCard</code> and geometric-block <code>PictureCard</code>.
          </p>
        </div>
      </div>

      <div className="spec-grid-2">
        {/* CARD 1: NEXTCIRCLECARD (ALL 4 STATES) */}
        <div className="spec-panel">
          <div className="spec-panel-head" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3 className="spec-panel-title">
              <PhIcon name="star-four" weight="duotone" size={20} color="#186A4B" />
              1. NextCircleCard (4 Real States)
            </h3>
            <div className="qc-segmented">
              {(['registered', 'nearby', 'dora', 'live'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`qc-seg-btn ${nextState === st ? 'active' : ''}`}
                  onClick={() => setNextState(st)}
                >
                  {st === 'registered'
                    ? 'Registered'
                    : st === 'nearby'
                      ? 'Lead Nearby'
                      : st === 'dora'
                        ? 'Dora-e-Quran'
                        : 'Live Now'}
                </button>
              ))}
            </div>
          </div>

          {/* Deep Emerald Hero Presentation (Al-Shamela Anchor) */}
          <div className="qc-hero-emerald">
            <div className="qc-hero-girih">
              <GirihWatermarkSvg />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: '#A7F3D0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <PhIcon
                  name={
                    nextState === 'registered'
                      ? 'check-circle'
                      : nextState === 'dora'
                        ? 'moon-stars'
                        : nextState === 'live'
                          ? 'broadcast'
                          : 'compass'
                  }
                  weight="fill"
                  size={14}
                />
                {nextState === 'registered'
                  ? 'Your Next Registered Circle'
                  : nextState === 'nearby'
                    ? 'Next Circle Near You · 0.8 km'
                    : nextState === 'dora'
                      ? 'Ramadan Dora-e-Quran Intensive'
                      : 'Starting Now · Doors Open'}
              </span>
              <span
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  padding: '3px 9px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {nextState === 'live' ? 'In Progress' : 'In 2h 15m'}
              </span>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
              {nextState === 'dora'
                ? 'Nightly Dora-e-Quran — Juz 15 (Al-Isra)'
                : 'Tafseer Surah Al-Kahf & Reflections'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#D1FAE5', marginBottom: 14 }}>
              <PhIcon name="map-pin" weight="fill" size={15} />
              <span>Jamia Masjid Al-Noor, Main Blvd Gulberg III</span>
            </div>

            {/* Large Split Clock + Portion & Section Chips */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 16,
                background: 'rgba(10, 37, 27, 0.38)',
                border: '1px solid rgba(255,255,255,0.1)',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {nextState === 'dora' ? '9:00' : '7:30'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#A7F3D0' }}>PM</span>
                <span style={{ fontSize: 12, color: '#D1FAE5', marginLeft: 6 }}>
                  · Today (After {nextState === 'dora' ? 'Isha' : 'Maghrib'})
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#FFF3E0',
                    color: '#92400E',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PhIcon name="book-open-text" weight="fill" size={13} />
                  {nextState === 'dora' ? 'Surah Al-Isra 1–111' : 'Al-Kahf · Ayah 1–31'}
                </span>
                <span
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    color: '#FFFFFF',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <PhIcon name="user" weight="fill" size={13} />
                  Brothers
                </span>
              </div>
            </div>

            {/* Dual Action Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 10 }}>
              <button
                type="button"
                className="qc-btn"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.24)',
                }}
              >
                <PhIcon name="path" weight="bold" size={16} />
                Directions
              </button>
              <button type="button" className="qc-btn qc-btn-white-hero">
                <PhIcon
                  name={nextState === 'registered' ? 'ticket' : 'calendar-plus'}
                  weight="fill"
                  size={16}
                />
                {nextState === 'registered' ? 'My Seat Pass (#14)' : 'Reserve Free Seat →'}
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2 & 3: PICTURECARD CAROUSEL + MAPPREVIEWCARD UPGRADE */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="images" weight="duotone" size={20} color="#186A4B" />
              2. PictureCard Carousel & 3. MapPreviewCard Upgrade
            </h3>
            <span className="spec-code-tag">PictureCard · MapPreviewCard</span>
          </div>

          <div className="spec-sublabel">
            PictureCard (&ldquo;Near You&rdquo; 172px Horizontal Mosque Cards with Architectural Art)
          </div>
          <div className="qc-picture-row">
            {picturePlaces.map((p) => (
              <div key={p.seed} className="qc-picture-card">
                <div className="qc-picture-art">
                  <VenueArchArtSvg seed={p.seed} height={92} />
                  <span className="qc-picture-dist">
                    <PhIcon name="navigation-arrow" weight="fill" size={10} color="#186A4B" />
                    {p.distance}
                  </span>
                </div>
                <div className="qc-picture-body">
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', lineHeight: 1.25 }}>
                    {p.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748B', marginTop: 2 }}>
                    <PhIcon name={p.sectionIcon} weight="duotone" size={13} color="#186A4B" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.venue}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="spec-sublabel">
            MapPreviewCard (Vector Street Cartography Replacing the 2 Rotated Rectangles!)
          </div>
          <div className="qc-map-preview-card">
            <svg width="100%" height="156" viewBox="0 0 500 156" preserveAspectRatio="xMidYMid slice">
              <rect width="500" height="156" fill="#EBF5F0" />
              {/* Parks & Green Blocks */}
              <rect x="20" y="14" width="110" height="65" rx="12" fill="#D5EDE2" />
              <rect x="330" y="20" width="140" height="80" rx="14" fill="#D5EDE2" />
              {/* Canal / River Curve */}
              <path
                d="M -10 120 Q 140 85, 280 110 T 510 70"
                stroke="#BAE6FD"
                strokeWidth="16"
                fill="none"
              />
              {/* Street Grid */}
              <g stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round">
                <line x1="0" y1="48" x2="500" y2="48" />
                <line x1="0" y1="96" x2="500" y2="96" />
                <line x1="115" y1="0" x2="95" y2="156" />
                <line x1="245" y1="0" x2="265" y2="156" />
                <line x1="385" y1="0" x2="365" y2="156" />
              </g>
              {/* Boulevard Arterial */}
              <line x1="0" y1="48" x2="500" y2="48" stroke="#FDE68A" strokeWidth="2.5" />
              {/* Venue Pins */}
              <g transform="translate(155, 42)">
                <circle r="16" fill="#186A4B" fillOpacity="0.2" />
                <circle r="9" fill="#186A4B" stroke="#FFFFFF" strokeWidth="2.5" />
              </g>
              <g transform="translate(260, 68)">
                <circle r="20" fill="#186A4B" fillOpacity="0.22" />
                <circle r="11" fill="#103A2A" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle r="4" fill="#FFB04D" />
              </g>
              <g transform="translate(370, 46)">
                <circle r="8" fill="#239B73" stroke="#FFFFFF" strokeWidth="2" />
              </g>
              <g transform="translate(98, 86)">
                <circle r="8" fill="#239B73" stroke="#FFFFFF" strokeWidth="2" />
              </g>
            </svg>

            <div className="qc-map-caption-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="ph-catalog-icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}>
                  <PhIcon name="map-trifold" weight="duotone" size={18} color="#186A4B" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    14 Quran Circles in Lahore
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>
                    Nearest is 800m away at Masjid Al-Noor
                  </div>
                </div>
              </div>
              <span className="qc-btn qc-btn-secondary qc-btn-sm">
                Open Map <PhIcon name="arrow-up-right" weight="bold" size={12} />
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4 & 5: READALONGCARD + AYAHOFTHEDAYCARD */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="book-open-text" weight="duotone" size={20} color="#186A4B" />
              4. ReadAlongCard & 5. AyahOfTheDayCard
            </h3>
            <span className="spec-code-tag">ReadAlongCard · AyahOfTheDayCard</span>
          </div>

          {/* ReadAlongCard */}
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #FFFDF9 0%, #FFF8EB 100%)',
              border: '1px solid #FDE2B8',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <PhIcon name="sparkle" weight="fill" size={13} /> Read Tonight&apos;s Portion (Feature 4)
              </span>
              <span className="qc-badge qc-badge-amber">Tonight · 7:30 PM</span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#111827' }}>
                Surah Al-Kahf · Ayahs 1 to 31
              </div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                Set by Ustadh Ahmad for tonight&apos;s circle at Jamia Masjid Al-Noor
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 11.5, color: '#92400E', fontWeight: 600 }}>
                <PhIcon name="check-circle" weight="duotone" size={14} /> Reading any ayah counts toward your week
              </span>
              <button type="button" className="qc-btn qc-btn-primary qc-btn-sm">
                <PhIcon name="book-open" weight="bold" size={14} />
                Open at Ayah 1
              </button>
            </div>
          </div>

          {/* AyahOfTheDayCard */}
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 3, borderRadius: 2, background: '#FFB04D' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#186A4B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Ayah of the Day
                </span>
              </div>
              <span className="qc-badge qc-badge-emerald">
                <PhIcon name="mosque" weight="duotone" size={13} /> Picked by Masjid Al-Noor
              </span>
            </div>

            <div className="qc-arabic-verse">
              وَٱصْبِرْ نَفْسَكَ مَعَ ٱلَّذِينَ يَدْعُونَ رَبَّهُم بِٱلْغَدَوٰةِ وَٱلْعَشِىِّ
              يُرِيدُونَ وَجْهَهُۥ <AyahMedallion number={28} size={28} />
            </div>

            <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55, fontStyle: 'italic' }}>
              &ldquo;And keep yourself patiently with those who call upon their Lord in the morning
              and the evening, seeking His countenance…&rdquo;
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid #EDF2F7' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>
                Surah Al-Kahf (18:28)
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="qc-icon-btn" style={{ width: 34, height: 34 }}>
                  <PhIcon name="share-network" weight="regular" size={15} />
                </button>
                <button type="button" className="qc-btn qc-btn-secondary qc-btn-sm">
                  Read in Surah <PhIcon name="arrow-right" weight="bold" size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 6, 7, 8: DAYSREADCARD + COMMUNITYTODAYCARD + FACILITIES/SHORTCUTS */}
        <div className="spec-panel">
          <div className="spec-panel-head">
            <h3 className="spec-panel-title">
              <PhIcon name="users-three" weight="duotone" size={20} color="#186A4B" />
              6. DaysReadCard, 7. CommunityTodayCard & 8. FacilitiesChecklist
            </h3>
            <span className="spec-code-tag">DaysRead · CommunityToday · Facilities</span>
          </div>

          {/* DaysReadCard */}
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                  Your Reading Rhythm (Private · No Guilt Streaks)
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, color: '#111827', marginTop: 2 }}>
                  {readTodayDone ? '5 of 7 days this week' : '4 of 7 days this week'}
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {readTodayDone ? '15 days read this month' : '14 days read this month'} · Daily goal: 4 pages
                </div>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
                  const done = i < 4 || (i === 4 && readTodayDone);
                  return (
                    <div
                      key={i}
                      style={{
                        width: 26,
                        height: 32,
                        borderRadius: 8,
                        background: done ? '#186A4B' : '#F1F5F9',
                        color: done ? '#FFFFFF' : '#94A3B8',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      <span>{d}</span>
                      {done && <PhIcon name="check" weight="bold" size={10} />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`qc-btn ${readTodayDone ? 'qc-btn-emerald' : 'qc-btn-primary'} qc-btn-sm`}
                onClick={() => setReadTodayDone(!readTodayDone)}
              >
                <PhIcon name="check-circle" weight="fill" size={15} />
                {readTodayDone ? 'Counted Today ✓' : 'I Read Quran Today'}
              </button>
              <button
                type="button"
                className={`qc-btn qc-btn-secondary qc-btn-sm`}
                onClick={() => setGoalMetDone(!goalMetDone)}
              >
                <PhIcon
                  name={goalMetDone ? 'check-circle' : 'flag-banner'}
                  weight={goalMetDone ? 'fill' : 'duotone'}
                  size={15}
                  color="#186A4B"
                />
                {goalMetDone ? 'Daily Goal Met (4 pages) ✓' : 'I Met My Daily Goal (4 pages)'}
              </button>
            </div>
          </div>

          {/* CommunityTodayCard */}
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: '#F3FBF7',
              border: '1px solid #BFE8D6',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: '#FFFFFF',
                color: '#186A4B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(24,106,75,0.1)',
                flexShrink: 0,
              }}
            >
              <PhIcon name="users-three" weight="duotone" size={26} color="#186A4B" />
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#186A4B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Read Together Today (National Solidarity)
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#103A2A' }}>
                1,420 people read Quran today
              </div>
              <div style={{ fontSize: 12, color: '#186A4B' }}>
                4,890 pages read together across all circles
              </div>
            </div>
          </div>

          {/* FacilitiesChecklist */}
          <div>
            <div className="spec-sublabel" style={{ marginBottom: 6 }}>
              FacilitiesChecklist (SessionScreen & VenueScreen)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { icon: 'drop', label: 'Wudu Area' },
                { icon: 'car-profile', label: 'On-Site Parking' },
                { icon: 'door-open', label: 'Dedicated Sisters Hall' },
                { icon: 'wheelchair', label: 'Step-Free Access' },
                { icon: 'wind', label: 'Air-Conditioned' },
              ].map((fac) => (
                <div
                  key={fac.label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 11px',
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#111827',
                  }}
                >
                  <PhIcon name={fac.icon} weight="duotone" size={16} color="#186A4B" />
                  {fac.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
