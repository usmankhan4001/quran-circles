import { useMemo, useState, type ReactNode } from 'react';
import type { AuditEntry } from '@qc/contracts';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { usePaged } from '../api/hooks';
import {
  Code,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  NoMatch,
  PageHeader,
  Phone,
  SelectField,
  TableCard,
  TextField,
  type Column,
} from '../components/ui';
import { useShellCity, useShellSearch } from '../components/ShellFilters';
import { useI18n } from '../i18n';
import { auditActor } from '../lib/audit';
import { auditStats } from '../lib/kpis';
import { filterBySearch } from '../lib/search';

/** Start of a Pakistan-time day, as a UTC instant the API accepts. */
export function dayStartUtc(date: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const d = new Date(`${date}T00:00:00+05:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** The end of that day: the start of the next one. */
export function dayEndUtc(date: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const d = new Date(`${date}T00:00:00+05:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Who did what, within the person's scope. Rows name actions and records, not personal data. */
export default function AuditPage() {
  const { t, localized, dateTime, number } = useI18n();
  const { api } = useSignedIn();
  const dir = useDirectory();
  const [cityId] = useShellCity();
  const [venueId, setVenueId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query] = useShellSearch(t('console.audit.search'));

  const fromUtc = dayStartUtc(from);
  const toUtc = dayEndUtc(to);
  const list = usePaged(
    (cursor) =>
      api.adminAudit.list({
        query: {
          limit: 50,
          cursor,
          ...(cityId ? { cityId } : {}),
          ...(venueId ? { venueId } : {}),
          ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
          ...(fromUtc ? { from: fromUtc } : {}),
          ...(toUtc ? { to: toUtc } : {}),
        },
      }),
    [api, cityId, venueId, entityType, fromUtc, toUtc],
  );

  const venueOptions = dir.venues
    .filter((v) => !cityId || v.cityId === cityId)
    .map((v) => ({ value: v.id, label: dir.venueName(v.id) }));

  const loaded = list.status === 'ready' ? list.items : [];
  const stats = useMemo(() => auditStats(loaded), [loaded]);
  const rows = useMemo(
    () =>
      filterBySearch(loaded, query, (e) => [
        e.actorName,
        e.action,
        e.entityType,
        e.entityId,
        dir.venueName(e.venueId),
        dir.cityName(e.cityId),
      ]),
    [loaded, query, dir],
  );

  const placeOf = (e: AuditEntry) =>
    e.venueId
      ? dir.venueName(e.venueId)
      : e.cityId
        ? localized(dir.cities.find((c) => c.id === e.cityId)?.name)
        : t('console.scope.national');

  // A name, else a masked number, else "System" only for work no person did (lib/audit.ts).
  const actorOf = (e: AuditEntry): ReactNode => {
    const actor = auditActor(e);
    switch (actor.kind) {
      case 'name':
        return <bdi>{actor.name}</bdi>;
      case 'phone':
        return <Phone value={actor.phone} masked />;
      case 'system':
        return t('console.audit.system');
      case 'unnamed':
        return t('console.invites.unnamed');
    }
  };

  // The artboard draws the log as rows: who did it in bold, then the action, record and place in
  // code type, and the time at the end edge.
  const columns: Column<AuditEntry>[] = [
    {
      id: 'entry',
      header: t('console.audit.col.entry'),
      rowHeader: true,
      cell: (e) => (
        <div className="audit-entry">
          <span className="audit-who">{actorOf(e)}</span>
          <span className="audit-code" dir="ltr">
            <Code>{e.action}</Code>
            {' · '}
            <Code>{e.entityType}</Code>
            {e.entityId ? (
              <>
                {' '}
                <Code>{e.entityId}</Code>
              </>
            ) : null}
            {' · '}
            <bdi>{placeOf(e)}</bdi>
          </span>
        </div>
      ),
    },
    {
      id: 'when',
      header: t('console.audit.col.when'),
      cell: (e) => <span className="audit-time">{dateTime(e.createdAt)}</span>,
    },
  ];

  return (
    <div className="page">
      <PageHeader title={t('console.audit.title')} intro={t('console.audit.intro')} hidden />
      <TableCard
        title={t('console.audit.card.title')}
        subtitle={
          list.status === 'ready'
            ? t('console.audit.card.sub', {
                entries: number(stats.entries),
                people: number(stats.people),
                exports: number(stats.exports),
              })
            : undefined
        }
        tag={<span className="tag tag-slate">{t('console.audit.card.tz')}</span>}
        footer={<span>{t('console.audit.card.foot')}</span>}
        filtersLabel={t('console.shell.filters')}
        filters={
          <>
            <SelectField
              id="filter-venue"
              label={t('console.shell.filter.venue')}
              value={venueId}
              placeholder={t('console.shell.filter.all')}
              onChange={(e) => setVenueId(e.target.value)}
              options={venueOptions}
            />
            <TextField
              id="filter-entity"
              label={t('console.audit.filter.entityType')}
              dir="ltr"
              maxLength={60}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
            <TextField
              id="filter-from"
              type="date"
              label={t('console.audit.filter.from')}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              id="filter-to"
              type="date"
              label={t('console.audit.filter.to')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </>
        }
      >
        {list.status === 'loading' ? <Loading /> : null}
        {list.status === 'error' ? <ErrorState error={list.error} onRetry={list.reload} /> : null}
        {list.status === 'ready' && list.items.length === 0 ? (
          <EmptyState title={t('console.audit.empty.title')} body={t('console.audit.empty.body')} />
        ) : null}
        {list.status === 'ready' && list.items.length > 0 && rows.length === 0 ? (
          <NoMatch query={query} partial={list.hasMore} />
        ) : null}
        {list.status === 'ready' && rows.length > 0 ? (
          <DataTable
            caption={t('console.audit.title')}
            className="audit-table"
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
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
    </div>
  );
}
