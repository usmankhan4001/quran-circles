import { useMemo, useState } from 'react';
import { can, type AdminSession } from '@qc/contracts';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { fetchAllPages, useAsync } from '../api/hooks';
import { Banner, Button, ErrorState, Loading, PageHeader, SelectField } from '../components/ui';
import { useI18n } from '../i18n';
import { mergeCsvParts, type CsvPart } from '../lib/csv';
import { saveTextFile, todayStamp } from '../lib/download';
import { errorMessageKeyOf } from '../lib/errors';

type Target = 'session' | 'venue' | 'city';

type Outcome =
  | { kind: 'done'; sessions: number }
  | { kind: 'empty' }
  | { kind: 'failed'; error: unknown; done: number; total: number }
  | { kind: 'unreadable' };

/**
 * Registration exports by session, venue or city. The API exports one session at a time and
 * writes an audit row for each, so a venue or city export asks for each session in scope in turn
 * and joins the results into one file with a leading session_id column. Nothing is saved unless
 * every session exported, so a file is never silently incomplete.
 */
export default function ExportsPage() {
  const { t, tp, localized, number } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const [target, setTarget] = useState<Target>('session');
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const sessions = useAsync(
    () => fetchAllPages((cursor) => api.adminSessions.list({ query: { limit: 100, cursor } })),
    [api],
  );

  // Only sessions the person may export are offered; the API checks again.
  const exportable = useMemo<AdminSession[]>(
    () =>
      sessions.status === 'ready'
        ? sessions.data.filter((s) =>
            can(principal, 'registration.export', { cityId: s.cityId, venueId: s.venueId }),
          )
        : [],
    [sessions, principal],
  );

  const options = useMemo(() => {
    if (target === 'session')
      return exportable.map((s) => ({
        value: s.id,
        label: `${localized(s.title)} (${localized(s.venue.name)})`,
      }));
    if (target === 'venue') {
      const ids = new Set(exportable.map((s) => s.venueId));
      return dir.venues
        .filter((v) => ids.has(v.id))
        .map((v) => ({ value: v.id, label: dir.venueName(v.id) }));
    }
    const ids = new Set(exportable.map((s) => s.cityId));
    return dir.cities
      .filter((c) => ids.has(c.id))
      .map((c) => ({ value: c.id, label: localized(c.name) }));
  }, [target, exportable, dir, localized]);

  const chosen = useMemo(
    () =>
      exportable.filter((s) =>
        target === 'session'
          ? s.id === choice
          : target === 'venue'
            ? s.venueId === choice
            : s.cityId === choice,
      ),
    [exportable, target, choice],
  );

  const run = async () => {
    if (chosen.length === 0) {
      setOutcome({ kind: 'empty' });
      return;
    }
    setBusy(true);
    setOutcome(null);
    const parts: CsvPart[] = [];
    try {
      for (const [index, session] of chosen.entries()) {
        setProgress({ done: index, total: chosen.length });
        parts.push({
          key: session.id,
          csv: await api.registrations.export({ params: { sessionId: session.id } }),
        });
      }
      const body = parts.length === 1 ? (parts[0] as CsvPart).csv : mergeCsvParts(parts);
      if (body === null) {
        setOutcome({ kind: 'unreadable' });
        return;
      }
      saveTextFile(`registrations-${target}-${todayStamp()}.csv`, body);
      setOutcome({ kind: 'done', sessions: chosen.length });
    } catch (error) {
      setOutcome({ kind: 'failed', error, done: parts.length, total: chosen.length });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const targetLabel = {
    session: t('console.exports.target.session'),
    venue: t('console.exports.filter.venue'),
    city: t('console.exports.filter.city'),
  } as const;

  return (
    <div className="page">
      <PageHeader title={t('console.exports.title')} intro={t('console.exports.intro')} />
      <Banner tone="info" title={t('console.exports.privacy.title')}>
        <p>{t('console.exports.privacy')}</p>
        <p>{t('console.exports.audited')}</p>
      </Banner>

      {sessions.status === 'loading' ? <Loading /> : null}
      {sessions.status === 'error' ? (
        <ErrorState error={sessions.error} onRetry={sessions.reload} />
      ) : null}
      {sessions.status === 'ready' ? (
        <form
          className="form card"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <SelectField
            id="export-target"
            label={t('console.exports.target.label')}
            value={target}
            onChange={(e) => {
              setTarget(e.target.value as Target);
              setChoice('');
              setOutcome(null);
            }}
            options={(['session', 'venue', 'city'] as const).map((k) => ({
              value: k,
              label: targetLabel[k],
            }))}
          />
          <SelectField
            id="export-choice"
            label={targetLabel[target]}
            value={choice}
            required
            placeholder={t('ui.selectPlaceholder')}
            onChange={(e) => {
              setChoice(e.target.value);
              setOutcome(null);
            }}
            options={options}
            hint={
              choice
                ? tp('console.exports.willExport', chosen.length)
                : t('console.exports.chooseHint')
            }
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" busy={busy} disabled={!choice}>
              {busy ? t('console.exports.generating') : t('console.exports.generate')}
            </Button>
          </div>
          {progress ? (
            <p role="status">
              {t('console.exports.progress', {
                done: number(progress.done),
                total: number(progress.total),
              })}
            </p>
          ) : null}
        </form>
      ) : null}

      {outcome?.kind === 'done' ? (
        <Banner tone="success">{tp('console.exports.done', outcome.sessions)}</Banner>
      ) : null}
      {outcome?.kind === 'empty' ? (
        <Banner tone="warning">{t('console.exports.empty')}</Banner>
      ) : null}
      {outcome?.kind === 'unreadable' ? (
        <Banner tone="danger" title={t('console.exports.failed')}>
          {t('console.exports.unreadable')}
        </Banner>
      ) : null}
      {outcome?.kind === 'failed' ? (
        <Banner tone="danger" title={t('console.exports.failed')}>
          <p>{t(errorMessageKeyOf(outcome.error))}</p>
          <p>
            {t('console.exports.partialNotSaved', {
              done: number(outcome.done),
              total: number(outcome.total),
            })}
          </p>
        </Banner>
      ) : null}
    </div>
  );
}
