import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  SESSION_STATUSES,
  can,
  type AdminSession,
  type SessionStatus,
  type Venue,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import { Icon } from '../components/icons';
import { useShellCity, useShellSearch } from '../components/ShellFilters';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  NoMatch,
  PageHeader,
  StatRow,
  Phone,
  SelectField,
  TableCard,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
import { sessionStats } from '../lib/kpis';
import { canSomewhere, isNavAllowed } from '../lib/permissions';
import { filterBySearch } from '../lib/search';
import { surahLabel } from '../lib/surahs';

export const SESSION_STATUS_KEYS = {
  draft: 'console.sessions.status.draft',
  published: 'console.sessions.status.published',
  cancelled: 'console.sessions.status.cancelled',
  archived: 'console.sessions.status.archived',
} as const satisfies Record<SessionStatus, MessageKey>;

const STATUS_TONE: Record<SessionStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  cancelled: 'danger',
  archived: 'neutral',
};

export const SECTION_KEYS = {
  women: 'sections.women',
  men: 'sections.men',
  family: 'sections.family',
} as const satisfies Record<AdminSession['section'], MessageKey>;

const PROGRAM_KEYS = {
  dora: 'programs.dora',
  circles: 'programs.circles',
} as const satisfies Record<AdminSession['program'], MessageKey>;

export const LANGUAGE_KEYS = {
  en: 'console.shell.language.en',
  ur: 'console.shell.language.ur',
} as const satisfies Record<AdminSession['language'], MessageKey>;

/** Sessions in the person's scope. The API filters by scope; the filters here only narrow it. */
export default function SessionsPage() {
  const { t, localized, number, time, weekdays, localDateTime, locale } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const [cityId] = useShellCity();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState('');
  const [status, setStatus] = useState<SessionStatus | ''>('');
  const [query] = useShellSearch(t('console.sessions.search'));

  const list = usePaged(
    (cursor) =>
      api.adminSessions.list({
        query: {
          limit: 50,
          cursor,
          ...(cityId ? { cityId } : {}),
          ...(venueId ? { venueId } : {}),
          ...(status ? { status } : {}),
        },
      }),
    [api, cityId, venueId, status],
  );

  const loaded = list.status === 'ready' ? list.items : [];
  const stats = useMemo(() => sessionStats(loaded, Date.now()), [loaded]);
  const rows = useMemo(
    () =>
      filterBySearch(loaded, query, (s) => [
        s.title,
        s.venue.name,
        s.circle?.name,
        s.circle?.teacherName,
        dir.cityName(s.cityId),
      ]),
    [loaded, query, dir],
  );
  // Sessions are added through the bulk import; the console has no single-session form yet.
  const canAdd = isNavAllowed(principal, 'import') && canSomewhere(principal, 'session.create');

  const venueOptions = dir.venues
    .filter((v) => !cityId || v.cityId === cityId)
    .map((v) => ({ value: v.id, label: dir.venueName(v.id) }));

  // Through the shared date helper, so Urdu figures are isolated and never run into the words.
  const when = (s: AdminSession) =>
    s.kind === 'one_off'
      ? localDateTime(s.startsOn, s.localStartTime)
      : s.daysOfWeek.length === 7
        ? `${t('console.sessions.daily')} · ${time(s.localStartTime)}`
        : `${weekdays(s.daysOfWeek)} · ${time(s.localStartTime)}`;

  const portionText = (s: AdminSession): string | null => {
    const o = s.nextOccurrence;
    if (!o) return null;
    const p = o.portion;
    if (!p) return o.portionLabel;
    switch (p.kind) {
      case 'para':
        return t('console.sessions.portion.para', { para: number(p.para) });
      case 'surah':
        return t('console.sessions.portion.surah', { surah: surahLabel(p.surah, locale, number) });
      case 'ayah_range':
        return t('console.sessions.portion.range', {
          surah: surahLabel(p.surah, locale, number),
          from: number(p.fromAyah),
          to: number(p.toAyah),
        });
      case 'lesson':
        return p.title;
    }
  };

  const selected = rows.find((s) => s.id === selectedId) ?? rows[0] ?? null;

  const columns: Column<AdminSession>[] = [
    {
      id: 'masjid',
      header: t('console.sessions.col.masjid'),
      rowHeader: true,
      cell: (s) => (
        <button
          type="button"
          className="row-select"
          aria-pressed={selected?.id === s.id}
          aria-label={t('console.sessions.inspect', { name: localized(s.title) })}
          onClick={() => setSelectedId(s.id)}
        >
          <span className="cell-strong">{localized(s.venue.name)}</span>
          <span className="cell-sub">{dir.cityName(s.cityId)}</span>
        </button>
      ),
    },
    {
      id: 'program',
      header: t('console.sessions.col.program'),
      cell: (s) => (
        <div className="cell-stack">
          <span className={`tag-square tag-${s.program === 'dora' ? 'amber' : 'emerald'}`}>
            {t(PROGRAM_KEYS[s.program])}
          </span>
          <span className="cell-title">{localized(s.title)}</span>
          <bdi className="cell-meta">{when(s)}</bdi>
        </div>
      ),
    },
    {
      id: 'portion',
      header: t('console.sessions.col.portion'),
      cell: (s) => {
        const text = portionText(s);
        return text ? (
          <span className="portion-pill">
            <Icon name="book-open-text" size={12} weight="fill" />
            <span>{text}</span>
          </span>
        ) : (
          <span className="cell-muted">{t('console.sessions.portion.none')}</span>
        );
      },
    },
    {
      id: 'section',
      header: t('console.sessions.col.section'),
      cell: (s) => (
        <span className={`tag tag-section-${s.section}`}>{t(SECTION_KEYS[s.section])}</span>
      ),
    },
    {
      id: 'teacher',
      header: t('console.sessions.col.teacher'),
      cell: (s) => (
        <div className="cell-stack">
          <span className="cell-strong">{s.circle?.teacherName ?? '—'}</span>
          <span className="cell-checkin">
            <Icon name="clock" size={11} weight="fill" />
            <span>{t('console.sessions.checkIn.none')}</span>
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('console.sessions.col.actions'),
      cell: (s) => {
        const place = { cityId: s.cityId, venueId: s.venueId };
        const registrations = can(principal, 'registration.list', place);
        const posters = can(principal, 'poster.read', place);
        if (!registrations && !posters) return null;
        return (
          <span className="row-icons">
            {registrations ? (
              <Link
                className="icon-link"
                to={`/sessions/${s.id}/registrations`}
                aria-label={`${t('console.sessions.registrations')} ${localized(s.title)}`}
              >
                <Icon name="users-three" size={15} />
              </Link>
            ) : null}
            {posters ? (
              <Link
                className="icon-link"
                to={`/sessions/${s.id}/posters`}
                aria-label={`${t('console.posters.tabs.posters')} ${localized(s.title)}`}
              >
                <Icon name="qr-code" size={15} />
              </Link>
            ) : null}
          </span>
        );
      },
    },
  ];

  const waiting = stats.waitingApproval;
  // Counts of loaded rows are exact only when there is no next page. Otherwise they are shown as
  // "at least" ("50+"), never as a total; an exact total needs `total` on the list response.
  const exact = !(list.status === 'ready' && list.hasMore);
  const shownCount = (n: number) => (exact ? number(n) : `${number(n)}+`);

  return (
    <div className="page">
      <PageHeader title={t('console.sessions.title')} intro={t('console.sessions.intro')} />
      {list.status === 'ready' ? (
        <StatRow
          label={t('console.kpi.label')}
          partial={list.status === 'ready' && list.hasMore}
          stats={[
            { id: 'masjids', label: t('console.kpi.activeMasjids'), value: dir.venues.length },
            { id: 'circles', label: t('console.kpi.circles'), value: stats.total },
            { id: 'week', label: t('console.kpi.thisWeek'), value: stats.thisWeek },
            {
              id: 'waiting',
              label: t('console.kpi.waiting'),
              value: stats.waitingApproval,
              tone: 'notice',
            },
          ]}
        />
      ) : null}
      <div className="workspace">
        <TableCard
          tabs={
            <>
              <span className="tab-pill tab-pill-on" aria-current="page">
                {t('console.sessions.tab.sessions', { count: shownCount(loaded.length) })}
              </span>
              {isNavAllowed(principal, 'venues') ? (
                <Link className="tab-pill" to="/venues">
                  {t('console.sessions.tab.venues', { count: number(dir.venues.length) })}
                </Link>
              ) : null}
              <span className="tag tag-amber tag-awaiting">
                {t('console.sessions.awaiting', { count: shownCount(waiting) })}
              </span>
              {canAdd ? (
                <Link className="btn btn-outline btn-small btn-tool" to="/import?kind=sessions">
                  <Icon name="file-csv" size={14} weight="duotone" />
                  <span>{t('console.sessions.add')}</span>
                </Link>
              ) : null}
            </>
          }
          filtersLabel={t('console.shell.filters')}
          filters={
            <>
              <SelectField
                id="filter-venue"
                label={t('console.shell.filter.venue')}
                value={venueId}
                placeholder={t('console.sessions.filter.allVenues')}
                onChange={(e) => setVenueId(e.target.value)}
                options={venueOptions}
              />
              <SelectField
                id="filter-status"
                label={t('console.shell.filter.status')}
                value={status}
                placeholder={t('console.sessions.filter.allStatuses')}
                onChange={(e) => setStatus(e.target.value as SessionStatus | '')}
                options={SESSION_STATUSES.map((s) => ({
                  value: s,
                  label: t(SESSION_STATUS_KEYS[s]),
                }))}
              />
            </>
          }
          footer={
            list.status === 'ready' && rows.length > 0 ? (
              <>
                <span>
                  {t('console.sessions.showing', {
                    shown: number(rows.length),
                    total: shownCount(loaded.length),
                  })}
                </span>
                <span className="card-foot-hint">{t('console.sessions.clickHint')}</span>
              </>
            ) : null
          }
        >
          {list.status === 'loading' ? <Loading /> : null}
          {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
          {list.status === 'ready' && list.items.length === 0 ? (
            <EmptyState
              title={t('console.sessions.empty.title')}
              body={t('console.sessions.empty.body')}
            />
          ) : null}
          {list.status === 'ready' && list.items.length > 0 && rows.length === 0 ? (
            <NoMatch query={query} partial={list.hasMore} />
          ) : null}
          {list.status === 'ready' && rows.length > 0 ? (
            <DataTable
              caption={t('console.sessions.title')}
              columns={columns}
              rows={rows}
              rowKey={(s) => s.id}
              rowClassName={(s) => (selected?.id === s.id ? 'row-selected' : undefined)}
            />
          ) : null}
          {list.status === 'ready' ? (
            <LoadMore
              hasMore={list.hasMore}
              loading={list.loadingMore}
              onLoadMore={list.loadMore}
              error={list.moreError}
            />
          ) : null}
        </TableCard>
        {selected ? <SessionInspector session={selected} /> : null}
      </div>
    </div>
  );
}

const FACILITY_KEYS = {
  wuduArea: 'facilities.wuduArea',
  parking: 'facilities.parking',
  womenSection: 'facilities.womenSection',
  elderWheelchairAccess: 'facilities.elderWheelchairAccess',
  childFriendly: 'facilities.childFriendly',
} as const satisfies Partial<Record<keyof Venue['facilities'], MessageKey>>;

/** The side card for the chosen row: the venue, tonight's portion, its section and facilities. */
function SessionInspector({ session }: { session: AdminSession }) {
  const { t, localized, number } = useI18n();
  const { principal } = useSignedIn();
  const dir = useDirectory();
  const venue = dir.venueById(session.venueId);
  const place = { cityId: session.cityId, venueId: session.venueId };
  const facilities = venue
    ? (Object.keys(FACILITY_KEYS) as (keyof typeof FACILITY_KEYS)[]).filter(
        (k) => venue.facilities[k],
      )
    : [];
  const o = session.nextOccurrence;
  const portion =
    o?.portion?.kind === 'ayah_range'
      ? t('console.sessions.portion.range', {
          surah: number(o.portion.surah),
          from: number(o.portion.fromAyah),
          to: number(o.portion.toAyah),
        })
      : o?.portion?.kind === 'surah'
        ? t('console.sessions.portion.surah', { surah: number(o.portion.surah) })
        : o?.portion?.kind === 'para'
          ? t('console.sessions.portion.para', { para: number(o.portion.para) })
          : o?.portion?.kind === 'lesson'
            ? o.portion.title
            : (o?.portionLabel ?? t('console.sessions.portion.none'));
  return (
    <aside className="inspector" aria-label={t('console.sessions.inspector.label')}>
      <div>
        <div className="inspector-head">
          <span className="eyebrow">{t('console.sessions.inspector.title')}</span>
          <Badge tone={STATUS_TONE[session.status]}>{t(SESSION_STATUS_KEYS[session.status])}</Badge>
        </div>
        <h2 className="inspector-title">{localized(session.venue.name)}</h2>
        <p className="inspector-sub">
          {localized(session.title)} · {dir.cityName(session.cityId)}
          {venue?.contactPhone ? (
            <>
              {' · '}
              <Phone value={venue.contactPhone} />
            </>
          ) : null}
        </p>
        <div className="inspector-box">
          <div>
            <div className="mini-label">{t('console.sessions.inspector.portion')}</div>
            <div className="mini-field mini-field-edit">
              <span>{portion}</span>
              <Icon name="pencil-simple" size={13} />
            </div>
          </div>
          <div>
            <div className="mini-label">{t('console.sessions.inspector.section')}</div>
            <div className="mini-field mini-field-sm">{t(SECTION_KEYS[session.section])}</div>
          </div>
        </div>
        <div className="inspector-facilities">
          <div className="mini-heading">{t('console.sessions.inspector.facilities')}</div>
          {facilities.length > 0 ? (
            <ul className="chip-list">
              {facilities.map((k) => (
                <li key={k} className="chip-soft">
                  <Icon name="check" size={11} weight="bold" />
                  {t(FACILITY_KEYS[k])}
                </li>
              ))}
            </ul>
          ) : (
            <p className="cell-muted">{t('console.sessions.inspector.noFacilities')}</p>
          )}
        </div>
      </div>
      <div className="inspector-actions">
        {/* Drawn on the artboard; the console has no session editor yet, so it stays off. */}
        <Button
          variant="primary"
          className="btn-small inspector-save"
          disabled
          title={t('console.sessions.inspector.saveSoon')}
        >
          <Icon name="check-circle" size={14} weight="fill" />
          <span>{t('console.sessions.inspector.save')}</span>
        </Button>
        {can(principal, 'registration.list', place) ? (
          <Link
            className="btn btn-outline btn-small"
            to={`/sessions/${session.id}/registrations`}
            aria-label={`${t('console.sessions.registrations')} ${localized(session.title)}`}
          >
            <Icon name="ticket" size={13} />
            <span>{t('console.sessions.registrations')}</span>
          </Link>
        ) : null}
        {can(principal, 'poster.read', place) ? (
          <Link
            className="btn btn-outline btn-small"
            to={`/sessions/${session.id}/posters`}
            aria-label={`${t('console.posters.tabs.posters')} ${localized(session.title)}`}
          >
            <Icon name="qr-code" size={13} />
            <span>{t('console.sessions.inspector.poster')}</span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
