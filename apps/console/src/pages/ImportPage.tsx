import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { canSomewhere } from '../lib/permissions';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { applyImport, type ApplyProgress, type ApplyReport } from '../import/apply';
import { dryRun, issueMessage, reportToCsv } from '../import/run';
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
  StepIndicator,
  type BadgeTone,
  type Column,
} from '../components/ui';
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
  | { name: 'reviewed'; report: DryRunReport<unknown> }
  | { name: 'applying'; report: DryRunReport<unknown>; progress: ApplyProgress }
  | { name: 'applied'; report: DryRunReport<unknown>; result: ApplyReport };

/**
 * Bulk import with a dry run. Choosing a file only reads it and checks it: nothing is sent to the
 * API until the person reviews the report and confirms. A file with any invalid row cannot be
 * applied, so a half-correct file never half-applies by accident.
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
  const [kind, setKind] = useState<ImportKind>(kinds[0] ?? 'venues');
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

  const report =
    phase.name === 'reviewed' || phase.name === 'applying' || phase.name === 'applied'
      ? phase.report
      : null;

  const run = async () => {
    if (phase.name !== 'reviewed') return;
    const { report: current } = phase;
    setConfirming(false);
    setPhase({
      name: 'applying',
      report: current,
      progress: { done: 0, total: current.counts.valid },
    });
    try {
      const result = await applyImport(current, api, (progress) =>
        setPhase({ name: 'applying', report: current, progress }),
      );
      setPhase({ name: 'applied', report: current, result });
      dir.reload();
    } catch (error) {
      setPhase({ name: 'failed', error });
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
      {phase.name === 'failed' ? (
        <ErrorState
          error={phase.error}
          onRetry={fileText !== null ? () => void check(fileText, kind) : undefined}
        />
      ) : null}

      {report && phase.name !== 'applied' ? (
        <Section title={t('console.import.step.check')}>
          <Banner tone="warning">{t('console.import.nothingSaved')}</Banner>
          <dl className="stats stats-four" aria-label={t('console.import.summary')}>
            <div className="stat">
              <dt className="stat-label">{t('console.import.count.total')}</dt>
              <dd className="stat-value">{number(report.counts.total)}</dd>
            </div>
            <div className="stat">
              <dt className="stat-label">{t('console.import.count.valid')}</dt>
              <dd className="stat-value">{number(report.counts.valid)}</dd>
            </div>
            <div className="stat">
              <dt className="stat-label">{t('console.import.count.duplicate')}</dt>
              <dd className="stat-value">{number(report.counts.duplicate)}</dd>
            </div>
            <div className={`stat${report.counts.invalid > 0 ? ' stat-warn' : ''}`}>
              <dt className="stat-label">{t('console.import.count.invalid')}</dt>
              <dd className="stat-value">{number(report.counts.invalid)}</dd>
            </div>
          </dl>

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
            <>
              <CheckboxField
                label={t('console.import.showAll')}
                checked={showAll}
                onChange={(e) => {
                  setShowAll(e.target.checked);
                  setLimit(SHOWN_AT_FIRST);
                }}
              />
              {issueRows.length > 0 ? (
                <>
                  <DataTable
                    caption={t('console.import.table.caption')}
                    columns={columns}
                    rows={issueRows.slice(0, limit)}
                    rowKey={(r) => String(r.line)}
                  />
                  {issueRows.length > limit ? (
                    <Button onClick={() => setLimit((n) => n + SHOWN_AT_FIRST)}>
                      {t('console.import.showMore', { count: number(issueRows.length - limit) })}
                    </Button>
                  ) : null}
                </>
              ) : (
                <p>{t('console.import.noProblems')}</p>
              )}
            </>
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
            {report.fileIssues.length > 0 || report.rows.some((r) => r.issues.length > 0) ? (
              <Button onClick={downloadReport}>{t('console.import.errors.download')}</Button>
            ) : null}
            <Button variant="ghost" disabled={phase.name === 'applying'} onClick={reset}>
              {t('console.import.startAgain')}
            </Button>
          </div>
          {phase.name === 'applying' ? (
            <p role="status">
              {t('console.import.applying', {
                done: number(phase.progress.done),
                total: number(phase.progress.total),
              })}
            </p>
          ) : null}
          <p className="field-hint">{fileName}</p>
        </Section>
      ) : null}

      {phase.name === 'applied' ? (
        <Section title={t('console.import.result')}>
          {phase.result.status === 'done' ? (
            <Banner tone="success">
              {t('console.import.done', { count: number(phase.result.created) })}
              {phase.result.skipped > 0
                ? ` ${tp('console.import.skippedExisting', phase.result.skipped)}`
                : ''}
            </Banner>
          ) : (
            <Banner tone="danger" title={t('console.import.stopped.title')}>
              <p>
                {t('console.import.stopped.body', {
                  created: number(phase.result.created),
                  remaining: number(phase.result.remaining),
                  line: number(phase.result.failedLine),
                })}
              </p>
              <p>{t(errorMessageKeyOf(phase.result.error))}</p>
              <p>{t('console.import.stopped.next')}</p>
            </Banner>
          )}
          <div className="form-actions">
            {phase.result.status === 'stopped' && fileText !== null ? (
              <Button variant="primary" onClick={() => void check(fileText, kind)}>
                {t('console.import.checkAgain')}
              </Button>
            ) : null}
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
          <p>{t('console.import.confirm.warning')}</p>
        </Modal>
      ) : null}
    </div>
  );
}
