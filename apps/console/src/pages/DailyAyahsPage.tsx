import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  BUILT_IN_DAILY_AYAHS,
  READING_RANGE_MAX_DAYS,
  addDays,
  pakistanDate,
  readingRangeIssue,
  type AdminCircle,
  type DailyAyahEntry,
  type DailyAyahScope,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { fetchAllPages, useAsync } from '../api/hooks';
import {
  AddButton,
  Badge,
  Banner,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  SegmentedControl,
  SelectField,
  TableCard,
  TextField,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
import {
  ayahCount,
  ayahProblem,
  buildPut,
  canManagePick,
  circlesFor,
  draftFromEntry,
  existingPickFor,
  fallbackDays,
  scopesFor,
  sortPicks,
  venuesFor,
  PICK_FIELD_PATHS,
  type DraftField,
  type DraftProblem,
  type PickDraft,
} from '../lib/daily-ayahs';
import { errorKind, errorMessageKeyOf, fieldIssues } from '../lib/errors';
import { surahLabel, surahNumbered } from '../lib/surahs';

type ScopeFilter = 'all' | DailyAyahScope;
const SCOPE_FILTERS: readonly ScopeFilter[] = ['all', 'national', 'venue', 'circle'];

const SCOPE_FILTER_KEYS = {
  all: 'console.dailyAyahs.filter.all',
  national: 'console.dailyAyahs.filter.national',
  venue: 'console.dailyAyahs.filter.venue',
  circle: 'console.dailyAyahs.filter.circle',
} as const satisfies Record<ScopeFilter, MessageKey>;

const SCOPE_KEYS = {
  national: 'console.scope.national',
  venue: 'console.dailyAyahs.scope.venue',
  circle: 'console.dailyAyahs.scope.circle',
} as const satisfies Record<DailyAyahScope, MessageKey>;

const REQUIRED_KEYS = {
  date: 'console.dailyAyahs.error.date.required',
  scopeType: 'console.dailyAyahs.error.scope.required',
  venueId: 'console.dailyAyahs.error.venue.required',
  circleId: 'console.dailyAyahs.error.circle.required',
  surah: 'console.dailyAyahs.error.surah.required',
  ayah: 'console.dailyAyahs.error.ayah.required',
} as const satisfies Record<DraftField, MessageKey>;

/** The form's first field, which takes focus when "Set a pick" or "Change" is pressed. */
const PICK_FIRST_FIELD = 'pick-date';

/** The days a fresh page shows: today and the next 30 days, in Pakistan time. */
const DEFAULT_SPAN_DAYS = 30;

const emptyDraft = (date: string): PickDraft => ({
  date,
  scopeType: '',
  venueId: '',
  circleId: '',
  surah: '',
  ayah: '',
});

/**
 * "Surah Al-Baqarah (2), ayah 255" in the screen's language, with the surah's name from the
 * content list. The console never shows the ayah's text.
 */
function useReference() {
  const { t, number, locale } = useI18n();
  return (ref: { surah: number; ayah: number }) =>
    t('console.dailyAyahs.ref', {
      surah: surahLabel(ref.surah, locale, number),
      ayah: number(ref.ayah),
    });
}

/**
 * The ayah of the day list (rc.4). National admins set national picks; coordinators set picks for
 * the venues and circles in their scope and see national picks read-only. Shown only when the
 * `ayah_of_the_day` flag is on and the person holds `daily_ayah.manage` (see `Guard`).
 */
export default function DailyAyahsPage() {
  const { t, number, date: formatDate, dateTime, localized } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const reference = useReference();

  const today = useMemo(() => pakistanDate(new Date()), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(() => addDays(today, DEFAULT_SPAN_DAYS));
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [removing, setRemoving] = useState<DailyAyahEntry | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [editing, setEditing] = useState<{ draft: PickDraft; key: number } | null>(null);

  const rangeIssue = from && to ? readingRangeIssue({ from, to }) : null;
  const rangeReady = Boolean(from && to) && rangeIssue === null;

  const picks = useAsync(async () => {
    if (!rangeReady) return [] as DailyAyahEntry[];
    const res = await api.adminDailyAyahs.list({
      query: { from, to, ...(scopeFilter === 'all' ? {} : { scopeType: scopeFilter }) },
    });
    return res.items;
  }, [api, from, to, scopeFilter, rangeReady]);

  // National picks for the fallback, whatever the scope filter shows.
  const nationalPicks = useAsync(async () => {
    if (!rangeReady) return [] as DailyAyahEntry[];
    if (scopeFilter === 'all' || scopeFilter === 'national') return null;
    const res = await api.adminDailyAyahs.list({ query: { from, to, scopeType: 'national' } });
    return res.items;
  }, [api, from, to, scopeFilter, rangeReady]);

  // Circles name circle picks and fill the form. A failure only hides circle choices.
  const circles = useAsync(
    () =>
      fetchAllPages((cursor) => api.adminCircles.list({ query: { limit: 100, cursor } })).then(
        (items) => items.filter((c) => c.status !== 'archived'),
      ),
    [api],
  );
  const circleList: AdminCircle[] = circles.status === 'ready' ? circles.data : [];
  const circleById = useMemo(() => new Map(circleList.map((c) => [c.id, c])), [circleList]);

  const scopes = scopesFor(principal, dir.venues, circleList);
  const canSetAny = scopes.length > 0;

  const loaded = picks.status === 'ready' ? sortPicks(picks.data) : [];
  const forFallback =
    nationalPicks.status === 'ready' && nationalPicks.data !== null ? nationalPicks.data : loaded;
  const fallback = rangeReady ? fallbackDays(from, to, forFallback) : [];

  const placeName = (p: Pick<DailyAyahEntry, 'scopeType' | 'venueId' | 'circleId'>): string => {
    if (p.scopeType === 'national') return t('console.scope.national');
    const venue = dir.venueName(p.venueId);
    if (p.scopeType === 'venue') return venue || t('console.dailyAyahs.place.unknown');
    const circle = circleById.get(p.circleId ?? '');
    if (!circle) return t('console.dailyAyahs.place.unknown');
    const circleName = localized(circle.name);
    return venue ? t('console.dailyAyahs.place.circle', { circle: circleName, venue }) : circleName;
  };

  const stats = useMemo(() => {
    const nationalDates = new Set(
      forFallback.filter((p) => p.scopeType === 'national').map((p) => p.date),
    );
    let days = 0;
    if (rangeReady) {
      for (let d = from; d <= to; d = addDays(d, 1)) days += 1;
    }
    return {
      days,
      national: loaded.filter((p) => p.scopeType === 'national').length,
      venue: loaded.filter((p) => p.scopeType === 'venue').length,
      circle: loaded.filter((p) => p.scopeType === 'circle').length,
      gaps: Math.max(0, days - nationalDates.size),
    };
  }, [loaded, forFallback, from, to, rangeReady]);

  const openForm = (draft?: PickDraft) => {
    setEditing((prev) => ({ draft: draft ?? emptyDraft(today), key: (prev?.key ?? 0) + 1 }));
    setNotice(null);
    // Focus moves to the form once it has the new values.
    window.setTimeout(() => document.getElementById(PICK_FIRST_FIELD)?.focus(), 0);
  };

  const remove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      await api.adminDailyAyahs.delete({ params: { dailyAyahId: removing.id } });
      setNotice(t('console.dailyAyahs.removed'));
      picks.reload();
      nationalPicks.reload();
    } catch (error) {
      if (errorKind(error) === 'not_found') {
        setNotice(t('console.dailyAyahs.remove.gone'));
        picks.reload();
        nationalPicks.reload();
      } else {
        setFailure(error);
      }
    } finally {
      setRemoveBusy(false);
      setRemoving(null);
    }
  };

  const columns: Column<DailyAyahEntry>[] = [
    {
      id: 'date',
      header: t('console.dailyAyahs.col.date'),
      rowHeader: true,
      cell: (p) => formatDate(`${p.date}T12:00:00Z`),
    },
    { id: 'ayah', header: t('console.dailyAyahs.col.ayah'), cell: (p) => reference(p) },
    {
      id: 'place',
      header: t('console.dailyAyahs.col.place'),
      cell: (p) => (
        <span className="pick-place">
          <Badge tone={p.scopeType === 'national' ? 'accent' : 'neutral'}>
            {t(SCOPE_KEYS[p.scopeType])}
          </Badge>
          {p.scopeType === 'national' ? null : <span>{placeName(p)}</span>}
        </span>
      ),
    },
    {
      id: 'updated',
      header: t('console.dailyAyahs.col.updated'),
      cell: (p) => dateTime(p.updatedAt),
    },
    {
      id: 'actions',
      header: t('console.dailyAyahs.col.actions'),
      cell: (p) => {
        if (!canManagePick(principal, p)) return <Badge>{t('console.dailyAyahs.viewOnly')}</Badge>;
        const label = { date: formatDate(`${p.date}T12:00:00Z`), place: placeName(p) };
        return (
          <div className="row-actions">
            <Button
              className="btn-small"
              variant="outline"
              aria-label={t('console.dailyAyahs.row.changeLabel', label)}
              onClick={() => openForm(draftFromEntry(p))}
            >
              {t('console.dailyAyahs.row.change')}
            </Button>
            <Button
              className="btn-small"
              variant="danger"
              aria-label={t('console.dailyAyahs.row.removeLabel', label)}
              onClick={() => setRemoving(p)}
            >
              {t('console.dailyAyahs.row.remove')}
            </Button>
          </div>
        );
      },
    },
  ];

  const rangeError =
    rangeIssue?.code === 'invalid_range'
      ? t('console.dailyAyahs.range.invalid')
      : rangeIssue?.code === 'too_big'
        ? t('console.dailyAyahs.range.tooBig', { days: number(READING_RANGE_MAX_DAYS) })
        : null;

  return (
    <div className="page">
      <PageHeader
        title={t('console.dailyAyahs.title')}
        intro={t('console.dailyAyahs.intro')}
        hidden
      />
      {notice ? (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      ) : null}
      {failure ? (
        <Banner tone="danger" onDismiss={() => setFailure(null)}>
          {t(errorMessageKeyOf(failure))}
        </Banner>
      ) : null}
      <CurationCard
        days={fallback}
        today={today}
        spanDays={rangeReady ? stats.days : null}
        counts={picks.status === 'ready' && rangeReady ? stats : null}
        onSchedule={canSetAny ? () => openForm() : null}
      />

      <div className={canSetAny ? 'split' : undefined}>
        <TableCard
          title={t('console.dailyAyahs.list.title')}
          filtersLabel={t('console.shell.filters')}
          filters={
            <>
              <TextField
                id="ayah-from"
                type="date"
                dir="ltr"
                label={t('console.dailyAyahs.filter.from')}
                value={from}
                error={rangeIssue?.path === 'from' ? rangeError : null}
                onChange={(e) => setFrom(e.target.value)}
              />
              <TextField
                id="ayah-to"
                type="date"
                dir="ltr"
                label={t('console.dailyAyahs.filter.to')}
                value={to}
                error={rangeIssue?.path === 'to' ? rangeError : null}
                onChange={(e) => setTo(e.target.value)}
              />
              <SegmentedControl
                label={t('console.dailyAyahs.filter.scope')}
                value={scopeFilter}
                options={SCOPE_FILTERS.map((f) => ({ value: f, label: t(SCOPE_FILTER_KEYS[f]) }))}
                onChange={setScopeFilter}
              />
            </>
          }
          action={
            canSetAny ? (
              <AddButton onClick={() => openForm()}>{t('console.dailyAyahs.add')}</AddButton>
            ) : null
          }
        >
          {!rangeReady ? (
            <EmptyState title={t('console.dailyAyahs.range.title')} body={rangeError ?? ''} />
          ) : null}
          {rangeReady && picks.status === 'loading' ? <Loading /> : null}
          {rangeReady && picks.status === 'error' ? (
            <ErrorState error={picks.error} onRetry={picks.reload} />
          ) : null}
          {rangeReady && picks.status === 'ready' && loaded.length === 0 ? (
            <EmptyState
              title={t('console.dailyAyahs.empty.title')}
              body={t('console.dailyAyahs.empty.body')}
            />
          ) : null}
          {rangeReady && picks.status === 'ready' && loaded.length > 0 ? (
            <DataTable
              caption={t('console.dailyAyahs.list.title')}
              columns={columns}
              rows={loaded}
              rowKey={(p) => p.id}
            />
          ) : null}
        </TableCard>
        {canSetAny ? (
          <PickPanel
            key={editing?.key ?? 0}
            initial={editing?.draft ?? emptyDraft(today)}
            scopes={scopes}
            circles={circleList}
            loaded={loaded}
            placeName={placeName}
            onSaved={(entry) => {
              setFailure(null);
              setNotice(
                t('console.dailyAyahs.form.saved', {
                  date: formatDate(`${entry.date}T12:00:00Z`),
                }),
              );
              setEditing((prev) => ({ draft: emptyDraft(today), key: (prev?.key ?? 0) + 1 }));
              picks.reload();
              nationalPicks.reload();
            }}
          />
        ) : null}
      </div>

      <FallbackCard
        days={fallback}
        loading={picks.status === 'loading' || nationalPicks.status === 'loading'}
      />

      {removing ? (
        <Modal
          title={t('console.dailyAyahs.remove.title')}
          careful
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button variant="primary" onClick={() => setRemoving(null)}>
                {t('console.dailyAyahs.remove.keep')}
              </Button>
              <Button variant="danger" busy={removeBusy} onClick={() => void remove()}>
                {t('console.dailyAyahs.remove.confirm')}
              </Button>
            </>
          }
        >
          <p>
            {t('console.dailyAyahs.remove.body', {
              date: formatDate(`${removing.date}T12:00:00Z`),
              place: placeName(removing),
              ref: reference(removing),
            })}
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * The artboard's "Daily ayah curation" card: the span and pick counts, the days left to the
 * built-in list, today's resolved ayah with where it comes from, and the next three days. The
 * console keeps only surah and ayah numbers, so the Arabic and the translation are not drawn here;
 * the card says the app's reader shows them.
 */
function CurationCard({
  days,
  today,
  spanDays,
  counts,
  onSchedule,
}: {
  days: ReturnType<typeof fallbackDays>;
  today: string;
  spanDays: number | null;
  counts: { national: number; venue: number; circle: number; gaps: number } | null;
  onSchedule: (() => void) | null;
}) {
  const { t, number, weekday } = useI18n();
  const reference = useReference();
  const headingId = useId();
  const todays = days.find((d) => d.date === today) ?? null;
  const next = days.filter((d) => d.date > today).slice(0, 3);
  const short = (d: { surah: number; ayah: number }) =>
    t('console.dailyAyahs.curation.short', { surah: number(d.surah), ayah: number(d.ayah) });
  const dayOf = (date: string) => weekday(new Date(`${date}T12:00:00Z`).getUTCDay());
  const sourceKey =
    todays?.source === 'national'
      ? 'console.dailyAyahs.fallback.source.national'
      : todays?.source === 'venue' || todays?.source === 'circle'
        ? 'console.dailyAyahs.curation.source.place'
        : 'console.dailyAyahs.fallback.source.builtIn';
  return (
    <section className="card curation-card" aria-labelledby={headingId}>
      <div className="curation-head">
        <div>
          <h2 id={headingId}>{t('console.dailyAyahs.curation.title')}</h2>
          {counts && spanDays !== null ? (
            <p className="table-card-sub">
              {t('console.dailyAyahs.curation.sub', {
                days: number(spanDays),
                national: number(counts.national),
                venue: number(counts.venue),
                circle: number(counts.circle),
              })}
            </p>
          ) : null}
        </div>
        {counts ? (
          <span className="tag tag-amber">
            {t('console.dailyAyahs.curation.gaps', { count: number(counts.gaps) })}
          </span>
        ) : null}
      </div>
      <div className="curation-preview">
        <div className="curation-preview-head">
          <span>
            {todays
              ? t('console.dailyAyahs.curation.today', { ref: reference(todays) })
              : t('console.dailyAyahs.curation.todayNone')}
          </span>
          {todays ? <span className="curation-source">{t(sourceKey)}</span> : null}
        </div>
        <p className="curation-ayah">
          {todays ? (
            <span className="ayah-medallion" aria-hidden="true">
              {number(todays.ayah)}
            </span>
          ) : null}
          <span>{t('console.dailyAyahs.form.textNote')}</span>
        </p>
      </div>
      <div className="curation-foot">
        <span>
          {next.length > 0
            ? t('console.dailyAyahs.curation.next', {
                list: next.map((d) => `${short(d)} (${dayOf(d.date)})`).join(' · '),
              })
            : null}
        </span>
        {onSchedule ? (
          <button type="button" className="link-action" onClick={onSchedule}>
            {t('console.dailyAyahs.curation.schedule')}
            <span className="card-foot-hint" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** What a day falls back to when it has no pick: the rule, then the next days for everyone. */
function FallbackCard({
  days,
  loading,
}: {
  days: ReturnType<typeof fallbackDays>;
  loading: boolean;
}) {
  const { t, number, date: formatDate } = useI18n();
  const reference = useReference();
  const headingId = useId();
  return (
    <section className="card fallback-card" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('console.dailyAyahs.fallback.title')}</h2>
      <p className="page-intro">
        {t('console.dailyAyahs.fallback.rule', { count: number(BUILT_IN_DAILY_AYAHS.length) })}
      </p>
      {loading ? <Loading /> : null}
      {!loading && days.length > 0 ? (
        <DataTable
          caption={t('console.dailyAyahs.fallback.caption')}
          rows={days}
          rowKey={(d) => d.date}
          columns={[
            {
              id: 'date',
              header: t('console.dailyAyahs.col.date'),
              rowHeader: true,
              cell: (d) => formatDate(`${d.date}T12:00:00Z`),
            },
            { id: 'ayah', header: t('console.dailyAyahs.col.ayah'), cell: (d) => reference(d) },
            {
              id: 'source',
              header: t('console.dailyAyahs.col.source'),
              cell: (d) =>
                d.source === 'national' ? (
                  <Badge tone="accent">{t('console.dailyAyahs.fallback.source.national')}</Badge>
                ) : (
                  <Badge>{t('console.dailyAyahs.fallback.source.builtIn')}</Badge>
                ),
            },
          ]}
        />
      ) : null}
    </section>
  );
}

/** The set-a-pick form, beside the table as on the invites page. */
function PickPanel({
  initial,
  scopes,
  circles,
  loaded,
  placeName,
  onSaved,
}: {
  initial: PickDraft;
  scopes: readonly DailyAyahScope[];
  circles: readonly AdminCircle[];
  loaded: readonly DailyAyahEntry[];
  placeName: (p: Pick<DailyAyahEntry, 'scopeType' | 'venueId' | 'circleId'>) => string;
  onSaved: (entry: DailyAyahEntry) => void;
}) {
  const { t, number, localized, locale } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const reference = useReference();
  const headingId = useId();
  // With only one scope there is nothing to choose.
  const [draft, setDraft] = useState<PickDraft>(() =>
    !initial.scopeType && scopes.length === 1 ? { ...initial, scopeType: scopes[0]! } : initial,
  );
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<PickDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const venues = venuesFor(principal, dir.venues);
  const allowedCircles = circlesFor(principal, circles);

  const message = (field: DraftField, problem: DraftProblem): string => {
    switch (problem.code) {
      case 'required':
        return t(REQUIRED_KEYS[field]);
      case 'invalid_date':
        return t('console.dailyAyahs.error.date.invalid');
      case 'surah_range':
        return t('console.dailyAyahs.error.surah.range');
      case 'ayah_not_in_surah':
        return t('console.dailyAyahs.error.ayah.notInSurah', {
          surah: surahLabel(problem.surah, locale, number),
          count: number(problem.count),
        });
      case 'ayah_number':
        return t('console.dailyAyahs.error.ayah.required');
    }
  };

  const check = buildPut(draft);
  const replaces = check.ok ? existingPickFor(check.body, loaded) : undefined;
  const surahNumber = Number(draft.surah);
  const count = draft.surah ? ayahCount(surahNumber) : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(null);
    const result = buildPut(draft);
    if (!result.ok) {
      const next: Partial<Record<DraftField, string>> = {};
      for (const [field, problem] of Object.entries(result.problems) as [
        DraftField,
        DraftProblem,
      ][])
        next[field] = message(field, problem);
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const entry = await api.adminDailyAyahs.put({ body: result.body });
      onSaved(entry);
    } catch (error) {
      const kind = errorKind(error);
      const next: Partial<Record<DraftField, string>> = {};
      if (kind === 'validation_failed') {
        const rejected = fieldIssues(error, PICK_FIELD_PATHS);
        for (const field of Object.keys(rejected) as DraftField[]) {
          next[field] =
            field === 'ayah'
              ? message('ayah', ayahProblem(draft.surah))
              : field === 'date'
                ? t('console.dailyAyahs.error.date.invalid')
                : field === 'surah'
                  ? t('console.dailyAyahs.error.surah.range')
                  : t(REQUIRED_KEYS[field]);
        }
      } else if (kind === 'not_found') {
        const placeField: DraftField | null =
          draft.scopeType === 'venue'
            ? 'venueId'
            : draft.scopeType === 'circle'
              ? 'circleId'
              : null;
        if (placeField) next[placeField] = t('console.dailyAyahs.error.placeGone');
      }
      setErrors(next);
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card side-card" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('console.dailyAyahs.form.title')}</h2>
      <form
        className="form"
        aria-labelledby={headingId}
        onSubmit={(e) => void submit(e)}
        noValidate
      >
        {failure ? <Banner tone="danger">{t(errorMessageKeyOf(failure))}</Banner> : null}
        <TextField
          id={PICK_FIRST_FIELD}
          type="date"
          dir="ltr"
          required
          label={t('console.dailyAyahs.form.date')}
          value={draft.date}
          error={errors.date}
          onChange={(e) => set({ date: e.target.value })}
        />
        <SelectField
          id="pick-scope"
          required
          label={t('console.dailyAyahs.form.scope')}
          value={draft.scopeType}
          error={errors.scopeType}
          placeholder={t('ui.selectPlaceholder')}
          onChange={(e) =>
            set({ scopeType: e.target.value as DailyAyahScope | '', venueId: '', circleId: '' })
          }
          options={scopes.map((s) => ({ value: s, label: t(SCOPE_KEYS[s]) }))}
        />
        {draft.scopeType === 'venue' ? (
          <SelectField
            id="pick-venue"
            required
            label={t('console.dailyAyahs.form.venue')}
            value={draft.venueId}
            error={errors.venueId}
            placeholder={t('ui.selectPlaceholder')}
            onChange={(e) => set({ venueId: e.target.value })}
            options={venues.map((v) => ({ value: v.id, label: localized(v.name) }))}
          />
        ) : null}
        {draft.scopeType === 'circle' ? (
          <SelectField
            id="pick-circle"
            required
            label={t('console.dailyAyahs.form.circle')}
            value={draft.circleId}
            error={errors.circleId}
            placeholder={t('ui.selectPlaceholder')}
            onChange={(e) => set({ circleId: e.target.value })}
            options={allowedCircles.map((c) => ({
              value: c.id,
              label: placeName({ scopeType: 'circle', venueId: c.venueId, circleId: c.id }),
            }))}
          />
        ) : null}
        <SelectField
          id="pick-surah"
          required
          label={t('console.dailyAyahs.form.surah')}
          value={draft.surah}
          error={errors.surah}
          placeholder={t('ui.selectPlaceholder')}
          onChange={(e) => set({ surah: e.target.value })}
          options={Array.from({ length: 114 }, (_, i) => ({
            value: String(i + 1),
            // "Surah 2 · Al-Baqarah (286 ayahs)": the number first, so the list stays in order.
            label: t('console.dailyAyahs.form.surahOption', {
              number: surahNumbered(i + 1, locale, number),
              count: number(ayahCount(i + 1) ?? 0),
            }),
          }))}
        />
        <TextField
          id="pick-ayah"
          type="number"
          inputMode="numeric"
          dir="ltr"
          required
          min={1}
          max={count}
          label={t('console.dailyAyahs.form.ayah')}
          hint={
            count !== undefined
              ? t('console.dailyAyahs.form.ayahHint', { count: number(count) })
              : t('console.dailyAyahs.form.ayahHintNoSurah')
          }
          value={draft.ayah}
          error={errors.ayah}
          onChange={(e) => set({ ayah: e.target.value })}
        />
        <div className="ayah-preview" role="status" aria-live="polite">
          <p className="ayah-preview-label">{t('console.dailyAyahs.form.preview')}</p>
          {check.ok ? (
            <>
              <p className="ayah-preview-ref">{reference(check.body)}</p>
              <p className="ayah-preview-note">
                {t('console.dailyAyahs.form.previewCount', {
                  surah: surahLabel(check.body.surah, locale, number),
                  count: number(ayahCount(check.body.surah) ?? 0),
                })}
              </p>
            </>
          ) : (
            <p className="ayah-preview-note">{t('console.dailyAyahs.form.previewEmpty')}</p>
          )}
          <p className="ayah-preview-note">{t('console.dailyAyahs.form.textNote')}</p>
        </div>
        {replaces ? (
          <Banner tone="notice">
            {t('console.dailyAyahs.form.replaces', { ref: reference(replaces) })}
          </Banner>
        ) : null}
        <div className="form-actions">
          <Button type="submit" variant="primary" busy={busy}>
            {t('console.dailyAyahs.form.save')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft({
                ...initial,
                scopeType: scopes.length === 1 ? scopes[0]! : '',
                venueId: '',
                circleId: '',
                surah: '',
                ayah: '',
              });
              setErrors({});
              setFailure(null);
            }}
          >
            {t('console.dailyAyahs.form.clear')}
          </Button>
        </div>
      </form>
    </section>
  );
}
