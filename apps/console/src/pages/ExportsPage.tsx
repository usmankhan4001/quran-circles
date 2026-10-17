import { useMemo, useState, type FormEvent } from 'react';
import {
  AdminRegistrationsExportQuery,
  REGISTRATION_EXPORT_MAX_ROWS,
  can,
  type AdminRegistrationsExportQuery as ExportQuery,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import {
  Banner,
  Button,
  ErrorState,
  Loading,
  PageHeader,
  SelectField,
  TextField,
} from '../components/ui';
import { useI18n } from '../i18n';
import { csvDataRowCount } from '../lib/csv';
import { saveTextFile, todayStamp } from '../lib/download';
import { errorMessageKeyOf, fieldIssues, issuesOf } from '../lib/errors';

type Outcome =
  { kind: 'saved'; rows: number } | { kind: 'empty' } | { kind: 'failed'; error: unknown };

type DateField = 'from' | 'to';

const DATE_PATHS: Readonly<Record<string, DateField>> = { from: 'from', to: 'to' };

/**
 * Registration exports for a city or a venue, with an optional date range, through the scoped
 * export (`adminRegistrations.export`). The server builds one file and writes one audit row for
 * what the person asked for. The console adds a byte order mark when it saves, so Excel reads
 * Urdu names. A single session's file is on its registrations page.
 */
export default function ExportsPage() {
  const { t, tp, localized, number } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const [chosenCity, setChosenCity] = useState('');
  const [chosenVenue, setChosenVenue] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [errors, setErrors] = useState<Partial<Record<DateField | 'venue', string>>>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Venues the person may export, and the cities they are in. The API checks again.
  const venues = useMemo(
    () =>
      dir.venues.filter((v) =>
        can(principal, 'registration.export', { cityId: v.cityId, venueId: v.id }),
      ),
    [dir.venues, principal],
  );
  const cities = useMemo(() => {
    const ids = new Set(venues.map((v) => v.cityId));
    return dir.cities.filter(
      (c) => ids.has(c.id) || can(principal, 'registration.export', { cityId: c.id }),
    );
  }, [dir.cities, venues, principal]);

  const cityId = chosenCity || (cities.length === 1 ? (cities[0]?.id ?? '') : '');
  const cityWide = cityId !== '' && can(principal, 'registration.export', { cityId });
  const venueOptions = venues
    .filter((v) => v.cityId === cityId)
    .map((v) => ({ value: v.id, label: dir.venueName(v.id) }));
  // Someone who may export only one venue there gets it chosen for them.
  const onlyVenue = !cityWide && venueOptions.length === 1 ? (venueOptions[0]?.value ?? '') : '';
  const venueId = chosenVenue || onlyVenue;

  const changed = () => setOutcome(null);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    setOutcome(null);
    const next: typeof errors = {};
    if (!cityWide && !venueId) next.venue = t('console.exports.venue.required');
    if (from && to && from > to) next.to = t('console.exports.dates.order');
    // A venue alone is enough, and keeps a venue coordinator inside their own scope.
    const query: ExportQuery = {
      ...(venueId ? { venueId } : { cityId }),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
    const parsed = AdminRegistrationsExportQuery.safeParse(query);
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const field = DATE_PATHS[String(issue.path[0])];
        if (field) next[field] = t('console.exports.dates.invalid');
      }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setBusy(true);
    try {
      const csv = await api.adminRegistrations.export({ query: parsed.data });
      const rows = csvDataRowCount(csv);
      if (rows === 0) {
        setOutcome({ kind: 'empty' });
        return;
      }
      saveTextFile(`registrations-${venueId ? 'venue' : 'city'}-${todayStamp()}.csv`, csv);
      setOutcome({ kind: 'saved', rows });
    } catch (error) {
      // Point a date the server refused at its field; anything else is a page-level message.
      const rejected = fieldIssues(error, DATE_PATHS);
      const fields: typeof errors = {};
      for (const field of ['from', 'to'] as const)
        if (rejected[field])
          fields[field] =
            rejected[field]?.code === 'invalid_range'
              ? t('console.exports.dates.order')
              : t('console.exports.dates.invalid');
      setErrors(fields);
      setOutcome({ kind: 'failed', error });
    } finally {
      setBusy(false);
    }
  };

  const failureKey = (error: unknown): MessageKey =>
    issuesOf(error).some((i) => i.code === 'too_many_rows')
      ? 'console.exports.tooMany'
      : errorMessageKeyOf(error);

  return (
    <div className="page">
      <PageHeader title={t('console.exports.title')} intro={t('console.exports.intro.scoped')} />
      <Banner tone="notice" title={t('console.exports.privacy.title')}>
        <p>{t('console.exports.privacy')}</p>
        <p>{t('console.exports.audited')}</p>
      </Banner>

      {dir.status === 'loading' ? <Loading /> : null}
      {dir.status === 'error' ? <ErrorState error={null} onRetry={dir.reload} /> : null}
      {dir.status === 'ready' ? (
        <form className="form form-grid card" onSubmit={(e) => void run(e)} noValidate>
          <SelectField
            id="export-city"
            label={t('console.exports.filter.city')}
            value={cityId}
            required
            placeholder={cities.length === 1 ? undefined : t('ui.selectPlaceholder')}
            disabled={busy}
            onChange={(e) => {
              setChosenCity(e.target.value);
              setChosenVenue('');
              changed();
            }}
            options={cities.map((c) => ({ value: c.id, label: localized(c.name) }))}
          />
          <SelectField
            id="export-venue"
            label={t('console.exports.filter.venue')}
            value={venueId}
            required={!cityWide}
            error={errors.venue}
            disabled={busy || !cityId}
            placeholder={
              cityWide
                ? t('console.exports.allVenues')
                : onlyVenue
                  ? undefined
                  : t('ui.selectPlaceholder')
            }
            onChange={(e) => {
              setChosenVenue(e.target.value);
              changed();
            }}
            options={venueOptions}
          />
          <TextField
            id="export-from"
            type="date"
            dir="ltr"
            label={t('console.exports.filter.from')}
            hint={t('console.exports.dates.hint')}
            optional
            error={errors.from}
            value={from}
            disabled={busy}
            onChange={(e) => {
              setFrom(e.target.value);
              changed();
            }}
          />
          <TextField
            id="export-to"
            type="date"
            dir="ltr"
            label={t('console.exports.filter.to')}
            optional
            error={errors.to}
            value={to}
            min={from || undefined}
            disabled={busy}
            onChange={(e) => {
              setTo(e.target.value);
              changed();
            }}
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" busy={busy} disabled={!cityId}>
              {busy ? t('console.exports.generating') : t('console.exports.generate')}
            </Button>
          </div>
          {busy ? <p role="status">{t('console.exports.generating')}</p> : null}
          <p className="field-hint form-note">{t('console.exports.sessionHint')}</p>
        </form>
      ) : null}

      {outcome?.kind === 'saved' ? (
        <Banner tone="success">
          <p>{tp('console.exports.savedRows', outcome.rows)}</p>
          <p>{t('console.exports.saved')}</p>
        </Banner>
      ) : null}
      {outcome?.kind === 'empty' ? (
        <Banner tone="warning">{t('console.exports.empty')}</Banner>
      ) : null}
      {outcome?.kind === 'failed' ? (
        <Banner tone="danger" title={t('console.exports.failed')}>
          {t(failureKey(outcome.error), { max: number(REGISTRATION_EXPORT_MAX_ROWS) })}
        </Banner>
      ) : null}
    </div>
  );
}
