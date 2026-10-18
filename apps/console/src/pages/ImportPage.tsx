import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router';
import { canSomewhere } from '../lib/permissions';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { dryRun, issueMessage, reportToCsv } from '../import/run';
import { commitImport, refusedFile } from '../import/server';
import { templateCsv } from '../import/templates';
import {
  IMPORT_KINDS,
  type DryRunReport,
  type DryRunRow,
  type ImportIssue,
  type ImportKind,
} from '../import/types';
import {
  Badge,
  Banner,
  Button,
  CheckboxField,
  DataTable,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Section,
  SelectField,
  StatRow,
  StepIndicator,
  TableCard,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { Icon } from '../components/icons';
import { useI18n } from '../i18n';
import { errorMessageKeyOf } from '../lib/errors';
import { saveTextFile } from '../lib/download';
import { DEFAULT_MAX_ROWS } from '../lib/csv';
import type { MessageKey } from '@qc/i18n';

const KIND_KEYS = {
  venues: 'console.import.kind.venues',
  coordinators: 'console.import.kind.coordinators',
  sessions: 'console.import.kind.sessions',
} as const satisfies Record<ImportKind, MessageKey>;

const KIND_HINT_KEYS = {
  venues: 'console.import.kind.venues.hint',
  coordinators: 'console.import.kind.coordinators.hint',
  sessions: 'console.import.kind.sessions.hint',
} as const satisfies Record<ImportKind, MessageKey>;

const STATUS_KEYS = {
  valid: 'console.import.status.valid',
  duplicate: 'console.import.status.duplicate',
  invalid: 'console.import.status.invalid',
} as const satisfies Record<DryRunRow<unknown>['status'], MessageKey>;

const STATUS_TONE: Record<DryRunRow<unknown>['status'], BadgeTone> = {
  valid: 'success',
  duplicate: 'warning',
  invalid: 'danger',
};

const SHOWN_AT_FIRST = 50;

type Phase =
  | { name: 'choose' }
  | { name: 'checking' }
  | { name: 'failed'; error: unknown }
  | {
      name: 'reviewed';
      report: DryRunReport<unknown>;
      /** The import was refused by the server: nothing was written, the report says why. */
      refused?: boolean;
      /** The import call failed (offline, rate limited...): nothing was written. */
      failure?: unknown;
    }
  | { name: 'applying'; report: DryRunReport<unknown> }
  | { name: 'applied'; report: DryRunReport<unknown>; created: number; skipped: number };

/**
 * Bulk import with a dry run. Choosing a file checks it twice, and neither check writes: first in
 * the browser, then with the server's dry run, which has the final say. The import itself is one
 * call after the person confirms, and the server applies it all or nothing, so a file never
 * half-applies.
 */
export default function ImportPage() {
  const { t, tp, number } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();
  const fileInput = useRef<HTMLInputElement>(null);

  const kinds = IMPORT_KINDS.filter((k) =>
    k === 'venues'
      ? canSomewhere(principal, 'venue.create')
      : k === 'coordinators'
        ? canSomewhere(principal, 'role.assign_venue_coordinator')
        : canSomewhere(principal, 'session.create'),
  );
  // "Add" on the Sessions and Venues pages opens this page with ?kind= set to what they add.
  const [params] = useSearchParams();
  const asked = kinds.find((k) => k === params.get('kind'));
  const [kind, setKind] = useState<ImportKind>(asked ?? kinds[0] ?? 'venues');
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [phase, setPhase] = useState<Phase>({ name: 'choose' });
  const [showAll, setShowAll] = useState(false);
  const [limit, setLimit] = useState(SHOWN_AT_FIRST);
  const [confirming, setConfirming] = useState(false);

  const check = async (text: string, forKind: ImportKind) => {
    setPhase({ name: 'checking' });
    setLimit(SHOWN_AT_FIRST);
    try {
      const report = await dryRun({ kind: forKind, text, api, directory: dir, principal });
      setPhase({ name: 'reviewed', report });
    } catch (error) {
      setPhase({ name: 'failed', error });
    }
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setPhase({ name: 'failed', error: new Error('unreadable') });
      return;
    }
    setFileText(text);
    void check(text, kind);
  };

  const reset = () => {
    setFileText(null);
    setFileName('');
    setPhase({ name: 'choose' });
    setConfirming(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  // The server refused the whole file (too many invitation rows, or the 24-hour invite limit).
  const failedFile =
    phase.name === 'failed'
      ? refusedFile(phase.error, kind)
      : phase.name === 'reviewed' && phase.failure !== undefined
        ? refusedFile(phase.failure, kind)
        : null;

  const report =
    phase.name === 'reviewed' || phase.name === 'applying' || phase.name === 'applied'
      ? phase.report
      : null;

  const run = async () => {
    if (phase.name !== 'reviewed') return;
    const { report: current } = phase;
    setConfirming(false);
    setPhase({ name: 'applying', report: current });
    try {
      const outcome = await commitImport(current, api);
      if (outcome.applied) {
        setPhase({
          name: 'applied',
          report: current,
          created: outcome.created,
          skipped: outcome.skipped,
        });
        dir.reload();
      } else {
        setShowAll(false);
        setPhase({ name: 'reviewed', report: outcome.report, refused: true });
      }
    } catch (error) {
      setPhase({ name: 'reviewed', report: current, failure: error });
    }
  };

  const downloadReport = () => {
    if (!report) return;
    saveTextFile(
      `import-report-${kind}.csv`,
      reportToCsv(report, (key, params) => t(key as MessageKey, params), {
        line: t('console.import.col.line'),
        status: t('console.import.col.status'),
        severity: t('console.import.col.severity'),
        column: t('console.import.col.column'),
        message: t('console.import.col.message'),
      }),
    );
  };

  const issueRows = useMemo(() => {
    if (!report) return [];
    return showAll ? report.rows : report.rows.filter((r) => r.issues.length > 0);
  }, [report, showAll]);

  const message = (i: ImportIssue) =>
    issueMessage(i, (key, params) => t(key as MessageKey, params));

  const columns: Column<DryRunRow<unknown>>[] = [
    {
      id: 'line',
      header: t('console.import.col.line'),
      rowHeader: true,
      cell: (r) => number(r.line),
    },
    { id: 'row', header: t('console.import.col.row'), cell: (r) => r.label },
    {
      id: 'status',
      header: t('console.import.col.status'),
      cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(STATUS_KEYS[r.status])}</Badge>,
    },
    {
      id: 'problems',
      header: t('console.import.col.problems'),
      cell: (r) =>
        r.issues.length === 0 ? (
          '–'
        ) : (
          <ul className="issue-list">
            {r.issues.map((i, n) => (
              <li key={n}>{message(i)}</li>
            ))}
          </ul>
        ),
    },
  ];

  const busy = phase.name === 'checking' || phase.name === 'applying';
  const hasProblems =
    report !== null &&
    (report.fileIssues.length > 0 || report.rows.some((r) => r.issues.length > 0));

  return (
    <div className="page">
      <PageHeader title={t('console.import.title')} intro={t('console.import.intro')} />
      <StepIndicator
        label={t('console.import.steps.label')}
        steps={[
          t('console.import.step.upload'),
          t('console.import.step.check'),
          t('console.import.step.import'),
        ]}
        current={
          phase.name === 'applied' ? 3 : phase.name === 'applying' ? 2 : report || busy ? 1 : 0
        }
      />
      <Banner tone="info" title={t('console.import.dryRun.title')}>
        {t('console.import.dryRun.help')}
      </Banner>

      <div className="form form-grid card">
        <SelectField
          id="import-kind"
          label={t('console.import.kind.label')}
          hint={t(KIND_HINT_KEYS[kind])}
          value={kind}
          disabled={busy}
          onChange={(e) => {
            setKind(e.target.value as ImportKind);
            reset();
          }}
          options={kinds.map((k) => ({ value: k, label: t(KIND_KEYS[k]) }))}
        />
        <div className="form-actions">
          <Button onClick={() => saveTextFile(`import-template-${kind}.csv`, templateCsv(kind))}>
            {t('console.import.template.download')}
          </Button>
        </div>
      </div>

      <Section title={t('console.import.step.upload')}>
        <div className="form">
          <div className="field field-file">
            <label className="field-label" htmlFor="import-file">
              {t('console.import.file.choose')}
            </label>
            <p id="import-file-hint" className="field-hint">
              {t('console.import.file.hint', { max: number(DEFAULT_MAX_ROWS) })}
            </p>
            <input
              ref={fileInput}
              id="import-file"
              className="input"
              type="file"
              accept=".csv,text/csv"
              aria-describedby="import-file-hint"
              disabled={busy}
              onChange={(e) => void onFile(e)}
            />
          </div>
        </div>
      </Section>

      {phase.name === 'choose' ? <p className="field-hint">{t('console.import.empty')}</p> : null}
      {phase.name === 'checking' ? <Loading label={t('console.import.dryRun.running')} /> : null}
      {phase.name === 'failed' && failedFile ? (
        <Banner tone="danger" title={t('console.import.refused.title')}>
          {t(failedFile.key, failedFile.params)}
        </Banner>
      ) : phase.name === 'failed' ? (
        <ErrorState
          error={phase.error}
          onRetry={fileText !== null ? () => void check(fileText, kind) : undefined}
        />
      ) : null}

      {report && phase.name !== 'applied' ? (
        <Section title={t('console.import.step.check')}>
          <Banner tone="warning">{t('console.import.nothingSaved')}</Banner>
          {phase.name === 'reviewed' && phase.refused ? (
            <Banner tone="danger" title={t('console.import.refused.title')}>
              {t('console.import.refused.body')}
            </Banner>
          ) : null}
          {phase.name === 'reviewed' && phase.failure !== undefined ? (
            <Banner tone="danger" title={t('console.import.refused.title')}>
              <p>
                {failedFile
                  ? t(failedFile.key, failedFile.params)
                  : t(errorMessageKeyOf(phase.failure))}
              </p>
              <p>{t('console.import.failed.nothingSaved')}</p>
            </Banner>
          ) : null}
          {report.serverChecked ? (
            <p className="field-hint">{t('console.import.serverChecked')}</p>
          ) : null}
          <StatRow
            label={t('console.import.summary')}
            stats={[
              { id: 'valid', label: t('console.import.count.valid'), value: report.counts.valid },
              {
                id: 'invalid',
                label: t('console.import.count.invalid'),
                value: report.counts.invalid,
                tone: 'notice',
              },
              {
                id: 'duplicate',
                label: t('console.import.count.duplicate'),
                value: report.counts.duplicate,
              },
              { id: 'total', label: t('console.import.count.total'), value: report.counts.total },
            ]}
          />

          {report.fileIssues.length > 0 ? (
            <ul className="issue-list" aria-label={t('console.import.fileProblems')}>
              {report.fileIssues.map((i, n) => (
                <li key={n}>
                  <Badge tone={i.severity === 'error' ? 'danger' : 'warning'}>
                    {t(
                      i.severity === 'error'
                        ? 'console.import.severity.error'
                        : 'console.import.severity.warning',
                    )}
                  </Badge>{' '}
                  {i.line > 0 ? `${t('console.import.atLine', { line: number(i.line) })} ` : ''}
                  {message(i)}
                </li>
              ))}
            </ul>
          ) : null}

          {report.counts.total === 0 && report.fileIssues.every((i) => i.severity !== 'error') ? (
            <EmptyState
              title={t('console.import.noRows.title')}
              body={t('console.import.noRows.body')}
            />
          ) : null}

          {report.canApply ? (
            <Banner tone="success">{tp('console.import.result.ready', report.counts.valid)}</Banner>
          ) : report.counts.total > 0 || report.fileIssues.length > 0 ? (
            <Banner tone="danger" title={t('console.import.blocked.title')}>
              {report.counts.valid === 0 &&
              report.counts.invalid === 0 &&
              report.fileIssues.every((i) => i.severity !== 'error') ? (
                t('console.import.blocked.nothingNew')
              ) : (
                <>
                  {report.counts.invalid > 0 ? (
                    <p>{tp('console.import.result.errors', report.counts.invalid)}</p>
                  ) : null}
                  <p>{t('console.import.blocked.body')}</p>
                </>
              )}
            </Banner>
          ) : null}

          {report.counts.total > 0 ? (
            <TableCard
              title={t('console.import.problems.title')}
              filters={
                <CheckboxField
                  label={t('console.import.showAll')}
                  checked={showAll}
                  onChange={(e) => {
                    setShowAll(e.target.checked);
                    setLimit(SHOWN_AT_FIRST);
                  }}
                />
              }
              action={
                hasProblems ? (
                  <Button onClick={downloadReport}>
                    <Icon name="download" size="sm" />
                    {t('console.import.errors.download')}
                  </Button>
                ) : null
              }
            >
              {issueRows.length > 0 ? (
                <>
                  <DataTable
                    caption={t('console.import.table.caption')}
                    columns={columns}
                    rows={issueRows.slice(0, limit)}
                    rowKey={(r) => String(r.line)}
                  />
                  {issueRows.length > limit ? (
                    <div className="load-more">
                      <Button onClick={() => setLimit((n) => n + SHOWN_AT_FIRST)}>
                        {t('console.import.showMore', { count: number(issueRows.length - limit) })}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="loading">{t('console.import.noProblems')}</p>
              )}
            </TableCard>
          ) : null}

          <div className="form-actions">
            <Button
              variant="primary"
              disabled={!report.canApply || phase.name === 'applying'}
              busy={phase.name === 'applying'}
              onClick={() => setConfirming(true)}
            >
              {tp('console.import.apply', report.counts.valid)}
            </Button>
            <Button
              disabled={phase.name === 'applying' || fileText === null}
              onClick={() => fileText !== null && void check(fileText, kind)}
            >
              {t('console.import.checkAgain')}
            </Button>
            {hasProblems && report.counts.total === 0 ? (
              <Button onClick={downloadReport}>{t('console.import.errors.download')}</Button>
            ) : null}
            <Button variant="ghost" disabled={phase.name === 'applying'} onClick={reset}>
              {t('console.import.startAgain')}
            </Button>
          </div>
          {phase.name === 'applying' ? <p role="status">{t('console.import.importing')}</p> : null}
          <p className="field-hint">{fileName}</p>
        </Section>
      ) : null}

      {phase.name === 'applied' ? (
        <Section title={t('console.import.result')}>
          <Banner tone="success">
            {t('console.import.done', { count: number(phase.created) })}
            {phase.skipped > 0 ? ` ${tp('console.import.skippedExisting', phase.skipped)}` : ''}
          </Banner>
          <div className="form-actions">
            <Button onClick={reset}>{t('console.import.another')}</Button>
          </div>
        </Section>
      ) : null}

      {confirming && report ? (
        <Modal
          title={t('console.import.confirm.title')}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button onClick={() => setConfirming(false)}>{t('console.shell.cancel')}</Button>
              <Button variant="primary" onClick={() => void run()}>
                {tp('console.import.apply', report.counts.valid)}
              </Button>
            </>
          }
        >
          <p>{tp('console.import.confirm.creating', report.counts.valid)}</p>
          {report.counts.duplicate > 0 ? (
            <p>{tp('console.import.confirm.skipped', report.counts.duplicate)}</p>
          ) : null}
          <p>{t('console.import.confirm.allOrNothing')}</p>
        </Modal>
      ) : null}
    </div>
  );
}
