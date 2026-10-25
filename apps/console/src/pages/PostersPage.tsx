import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  POSTER_ACCENTS,
  POSTER_LANGUAGES,
  POSTER_QR_TARGETS,
  can,
  type AdminSession,
  type Poster,
  type PosterTemplate,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useAsync, type AsyncState } from '../api/hooks';
import { SessionTabs } from '../components/SessionTabs';
import {
  Badge,
  Banner,
  Button,
  CheckboxField,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  SelectField,
  TextField,
  type BadgeTone,
} from '../components/ui';
import { Icon } from '../components/icons';
import { useI18n, type I18n } from '../i18n';
import { saveBinaryFile } from '../lib/download';
import { errorKind, errorMessageKeyOf, issuesOf } from '../lib/errors';
import {
  OUT_OF_DATE_KEYS,
  POSTER_ACCENT_KEYS,
  POSTER_DETAILS_MAX,
  POSTER_FAILURE_KEYS,
  POSTER_FORMAT_HINT_KEYS,
  POSTER_FORMAT_KEYS,
  POSTER_LANGUAGE_KEYS,
  POSTER_QR_HINT_KEYS,
  POSTER_QR_KEYS,
  POSTER_STATUS_KEYS,
  POSTER_TITLE_MAX,
  beingReplaced,
  buildPosterCreate,
  formFromPoster,
  formLanguages,
  formatLocalTime,
  hasQueued,
  initialPosterForm,
  mergePosters,
  outOfDateKind,
  posterActions,
  posterFileName,
  posterMime,
  serverPosterErrors,
  withTemplate,
  type PosterFieldProblem,
  type PosterForm,
  type PosterFormErrors,
} from '../lib/posters';

/** While a poster is being made, the list asks again this often. */
export const POSTER_POLL_MS = 5000;

const STATUS_TONE: Record<Poster['status'], BadgeTone> = {
  queued: 'neutral',
  ready: 'success',
  failed: 'danger',
};

/**
 * The posters of one session (contract 1.0.0-rc.5): make new ones from a template, see each one's
 * status, regenerate one the session has moved away from, and download the files. The date, time
 * and venue come from the session, never from the form. Hidden by `poster.read` and
 * `poster.create` at the session's venue; the API checks every call again.
 */
export default function PostersPage() {
  const { sessionId = '' } = useParams();
  const { t, localized } = useI18n();
  const { api, principal } = useSignedIn();
  const session = useAsync(
    () => api.adminSessions.get({ params: { sessionId } }),
    [api, sessionId],
  );
  const data = session.status === 'ready' ? session.data : null;
  const place = data ? { cityId: data.cityId, venueId: data.venueId } : null;

  return (
    <div className="page">
      <PageHeader
        title={
          data
            ? t('console.posters.titleFor', { session: localized(data.title) })
            : t('console.posters.title')
        }
        intro={t('console.posters.intro')}
        hidden
      />
      <p className="back-link">
        <Link to="/sessions">{t('console.exports.registrations.back')}</Link>
      </p>
      <SessionTabs sessionId={sessionId} place={place} />
      {session.status === 'loading' ? <Loading /> : null}
      {session.status === 'error' ? (
        <SessionProblem error={session.error} onRetry={session.reload} />
      ) : null}
      {data && place ? (
        can(principal, 'poster.read', place) ? (
          <PostersWorkspace session={data} canCreate={can(principal, 'poster.create', place)} />
        ) : (
          <EmptyState
            title={t('console.posters.forbidden.title')}
            body={t('console.posters.forbidden.body')}
          />
        )
      ) : null}
    </div>
  );
}

/** A session the API will not show: gone, outside the person's places, or a failed load. */
function SessionProblem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useI18n();
  const kind = errorKind(error);
  if (kind === 'not_found')
    return (
      <EmptyState
        title={t('console.posters.notFound.title')}
        body={t('console.posters.notFound.body')}
      />
    );
  if (kind === 'forbidden')
    return (
      <EmptyState
        title={t('console.posters.forbidden.title')}
        body={t('console.posters.forbidden.body')}
      />
    );
  return <ErrorState error={error} onRetry={onRetry} />;
}

/** "Every day at 9:00 pm", "Tue, Thu at 7:00 pm" or "15 Feb 2027 at 7:00 pm". */
function whenOf(s: AdminSession, i18n: I18n): string {
  const time = formatLocalTime(s.localStartTime, i18n.locale);
  if (s.kind === 'one_off' || s.daysOfWeek.length === 0)
    return i18n.t('console.posters.source.once', { date: i18n.date(s.startsOn), time });
  if (s.daysOfWeek.length === 7) return i18n.t('console.posters.source.daily', { time });
  return i18n.t('console.posters.source.weekly', {
    days: i18n.weekdays([...s.daysOfWeek].sort()),
    time,
  });
}

function PostersWorkspace({ session, canCreate }: { session: AdminSession; canCreate: boolean }) {
  const i18n = useI18n();
  const { t, localized } = i18n;
  const { api } = useSignedIn();
  const [recent, setRecent] = useState<Poster[]>([]);
  const [editRequest, setEditRequest] = useState<{ form: PosterForm; n: number } | null>(null);
  // Only someone who may make posters may list the templates (`poster.create`).
  const templates = useAsync(
    () => (canCreate ? api.adminPosters.templates().then((r) => r.items) : Promise.resolve([])),
    [api, canCreate],
  );
  const templateList = templates.status === 'ready' ? templates.data : [];
  const templateName = (key: string) => {
    const found = templateList.find((x) => x.key === key);
    return found ? localized(found.name) : key;
  };
  const list = useAsync(
    () => api.adminPosters.list({ params: { sessionId: session.id } }).then((r) => r.items),
    [api, session.id],
  );
  const listed = list.status === 'ready' ? list.data : [];
  const posters = useMemo(() => mergePosters(listed, recent), [listed, recent]);
  const queued = hasQueued(posters);
  const reload = list.reload;

  // Ask again while something is being made, so a finished poster appears without a click.
  useEffect(() => {
    if (!queued) return;
    const timer = window.setInterval(reload, POSTER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [queued, reload]);

  const added = (items: Poster[]) => {
    setRecent((prev) => [...items, ...prev.filter((p) => !items.some((i) => i.id === p.id))]);
    reload();
  };

  return (
    <div className="split split-posters">
      <section className="card poster-column" aria-labelledby="poster-list-title">
        <div className="generator-head">
          <div>
            <h2 id="poster-list-title">{t('console.posters.list.title')}</h2>
            <p className="table-card-sub">{t('console.posters.generator.sub')}</p>
          </div>
        </div>
        <section className="poster-source" aria-labelledby="poster-source-title">
          <h3 id="poster-source-title">{t('console.posters.source.title')}</h3>
          <dl className="poster-source-list">
            <div>
              <dt>{t('console.posters.source.when')}</dt>
              <dd>{whenOf(session, i18n)}</dd>
            </div>
            <div>
              <dt>{t('console.posters.source.venue')}</dt>
              <dd>{localized(session.venue.name)}</dd>
            </div>
          </dl>
          <p className="poster-note">{t('console.posters.source.note')}</p>
        </section>
        {list.status === 'loading' ? <Loading /> : null}
        {list.status === 'error' ? (
          errorKind(list.error) === 'forbidden' ? (
            <EmptyState
              title={t('console.posters.forbidden.title')}
              body={t('console.posters.forbidden.body')}
            />
          ) : (
            <ErrorState error={list.error} onRetry={reload} />
          )
        ) : null}
        {list.status === 'ready' && posters.length === 0 ? (
          <EmptyState
            title={t('console.posters.empty.title')}
            body={canCreate ? t('console.posters.empty.body') : t('console.posters.empty.readOnly')}
          />
        ) : null}
        {list.status === 'ready' && posters.length > 0 ? (
          <PosterList
            posters={posters}
            templateName={templateName}
            canCreate={canCreate}
            onRegenerated={(p) => added([p])}
            onEdit={(p) =>
              setEditRequest((prev) => ({ form: formFromPoster(p), n: (prev?.n ?? 0) + 1 }))
            }
          />
        ) : null}
        <p className="generator-foot">
          {t('console.posters.generator.foot', {
            templates: templateList.map((x) => localized(x.name)).join(' & ') || '—',
          })}
        </p>
      </section>
      {canCreate ? (
        <PosterFormCard
          session={session}
          templates={templates}
          editRequest={editRequest}
          onCreated={(items) => added(items)}
        />
      ) : null}
    </div>
  );
}

function PosterList({
  posters,
  templateName,
  canCreate,
  onRegenerated,
  onEdit,
}: {
  posters: Poster[];
  templateName: (key: string) => string;
  canCreate: boolean;
  onRegenerated: (poster: Poster) => void;
  onEdit: (poster: Poster) => void;
}) {
  const replaced = beingReplaced(posters);
  return (
    <ul className="poster-list">
      {posters.map((p) => (
        <li key={p.id}>
          <PosterCard
            poster={p}
            templateName={templateName(p.templateKey)}
            actions={posterActions(p, canCreate, replaced)}
            pending={replaced.has(p.id)}
            onRegenerated={onRegenerated}
            onEdit={onEdit}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The poster itself, drawn from the file the renderer made, for the picture formats. A print PDF has
 * no preview here, so it keeps the plain tile. The picture is fetched with the sign-in (the file
 * route needs it), shown with the poster's own description, and released when the card goes.
 */
function PosterPreview({ poster: p, title }: { poster: Poster; title: string }) {
  const { api } = useSignedIn();
  const { locale } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const picture = p.status === 'ready' && posterMime(p.format) === 'image/png';
  useEffect(() => {
    if (!picture) return;
    let live = true;
    let made: string | null = null;
    api.adminPosters
      .file({ params: { posterId: p.id } })
      .then((bytes) => {
        if (!live) return;
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        made = URL.createObjectURL(new Blob([copy.buffer], { type: 'image/png' }));
        setUrl(made);
      })
      .catch(() => {
        /* the tile stays; download shows the error */
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [api, p.id, picture]);
  if (url) {
    const alt = p.altText?.[locale === 'ur' ? 'ur' : 'en'] ?? p.altText?.en ?? p.altText?.ur ?? '';
    return (
      <div className={`poster-thumb poster-thumb-image poster-thumb-${p.format}`}>
        <img src={url} alt={alt} />
      </div>
    );
  }
  return (
    <div className={`poster-thumb poster-thumb-${p.format}`} aria-hidden="true">
      <span className="poster-thumb-title">{title}</span>
      <Icon name="qr-code" size={16} weight="bold" />
    </div>
  );
}

type CardFailure = { kind: 'regenerate' | 'download'; error: unknown };

/** One plain sentence for a refused or failed regenerate or download. */
function failureKey(f: CardFailure): MessageKey {
  const kind = errorKind(f.error);
  if (kind === 'forbidden') return 'console.posters.error.forbiddenAction';
  if (kind === 'conflict')
    return f.kind === 'regenerate'
      ? 'console.posters.error.regenerateConflict'
      : 'console.posters.error.downloadConflict';
  if (kind === 'not_found') return 'console.posters.error.posterGone';
  return errorMessageKeyOf(f.error);
}

function PosterCard({
  poster: p,
  templateName,
  actions,
  pending,
  onRegenerated,
  onEdit,
}: {
  poster: Poster;
  templateName: string;
  actions: ReturnType<typeof posterActions>;
  pending: boolean;
  onRegenerated: (poster: Poster) => void;
  onEdit: (poster: Poster) => void;
}) {
  const { t, dateTime } = useI18n();
  const { api } = useSignedIn();
  const headingId = useId();
  const [busy, setBusy] = useState<'regenerate' | 'download' | null>(null);
  const [failure, setFailure] = useState<CardFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const title = p.fields.title[p.locale] ?? p.fields.title.en ?? p.fields.title.ur ?? '';
  const outOfDate = p.outOfDate ? outOfDateKind(p.outOfDate.reasons) : null;
  const fileKind = p.format === 'print_a4' || p.format === 'print_a3' ? 'pdf' : 'png';

  const regenerate = async () => {
    setBusy('regenerate');
    setFailure(null);
    setSaved(false);
    try {
      onRegenerated(await api.adminPosters.regenerate({ params: { posterId: p.id } }));
    } catch (error) {
      setFailure({ kind: 'regenerate', error });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('download');
    setFailure(null);
    setSaved(false);
    try {
      const bytes = await api.adminPosters.file({ params: { posterId: p.id } });
      saveBinaryFile(posterFileName(p), bytes, posterMime(p.format));
      setSaved(true);
    } catch (error) {
      setFailure({ kind: 'download', error });
    } finally {
      setBusy(null);
    }
  };

  const regenerateButton = (label: MessageKey) => (
    <Button
      variant={outOfDate ? 'primary' : 'secondary'}
      busy={busy === 'regenerate'}
      disabled={busy !== null}
      onClick={() => void regenerate()}
      aria-describedby={headingId}
    >
      {t(label)}
    </Button>
  );

  return (
    <article className="card poster-card" aria-labelledby={headingId}>
      <PosterPreview poster={p} title={title} />
      <div className="poster-card-head">
        <h3 id={headingId}>
          {t('console.posters.card.title', {
            template: templateName,
            format: t(POSTER_FORMAT_KEYS[p.format]),
          })}
        </h3>
        <div className="poster-tags">
          <Badge tone={STATUS_TONE[p.status]}>{t(POSTER_STATUS_KEYS[p.status])}</Badge>
          {outOfDate ? <Badge tone="warning">{t('console.posters.outOfDate.tag')}</Badge> : null}
        </div>
      </div>
      {title ? (
        <p className="poster-title" lang={p.locale} dir={p.locale === 'ur' ? 'rtl' : 'ltr'}>
          {title}
        </p>
      ) : null}
      <p className="poster-meta">
        {t('console.posters.card.meta', {
          language: t(POSTER_LANGUAGE_KEYS[p.language]),
          date: dateTime(p.createdAt),
        })}
      </p>

      {outOfDate ? (
        <Banner tone="notice" title={t('console.posters.outOfDate.title')}>
          <p>{t(OUT_OF_DATE_KEYS[outOfDate])}</p>
          {pending ? (
            <p>{t('console.posters.replacing')}</p>
          ) : actions.regenerate ? (
            <div className="form-actions">{regenerateButton('console.posters.regenerate')}</div>
          ) : null}
        </Banner>
      ) : null}

      {!outOfDate && pending ? (
        <p className="poster-note">{t('console.posters.replacing')}</p>
      ) : null}
      {p.status === 'queued' ? (
        <p className="poster-note" role="status">
          {p.replacesPosterId ? t('console.posters.queued.again') : t('console.posters.queued')}
        </p>
      ) : null}
      {p.status === 'failed' ? (
        <p className="poster-failure">
          <Icon name="warning-circle" size="sm" />
          {t(POSTER_FAILURE_KEYS[p.failureCode ?? 'render_failed'])}
        </p>
      ) : null}

      {failure ? (
        <Banner tone="danger" title={t('console.posters.error.title')}>
          {t(failureKey(failure))}
        </Banner>
      ) : null}
      {saved ? <Banner tone="success">{t('console.posters.downloaded')}</Banner> : null}

      <div className="poster-actions">
        {actions.download ? (
          <Button
            variant="outline"
            busy={busy === 'download'}
            disabled={busy !== null}
            onClick={() => void download()}
            aria-describedby={headingId}
          >
            <Icon name="download-simple" size="sm" />
            {fileKind === 'pdf'
              ? t('console.posters.download.pdf')
              : t('console.posters.download.png')}
          </Button>
        ) : null}
        {p.status === 'failed' && actions.regenerate
          ? regenerateButton('console.posters.retry')
          : null}
        {actions.edit ? (
          <Button variant="secondary" onClick={() => onEdit(p)} aria-describedby={headingId}>
            {t('console.posters.editAgain')}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

// The form --------------------------------------------------------------------------------

const PROBLEM_KEYS: Record<PosterFieldProblem, MessageKey> = {
  required: 'console.posters.form.error.required',
  tooLong: 'console.posters.form.error.tooLong',
  invalid: 'console.posters.form.error.invalid',
  notOffered: 'console.posters.form.error.notOffered',
};

function RadioOption({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="check check-radio">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <label htmlFor={id}>
        {label}
        {hint ? (
          <span id={`${id}-hint`} className="check-hint">
            {hint}
          </span>
        ) : null}
      </label>
    </div>
  );
}

function FieldsetError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <Icon name="warning-circle" size="sm" />
      {message}
    </p>
  );
}

function PosterFormCard({
  session,
  templates,
  editRequest,
  onCreated,
}: {
  session: AdminSession;
  templates: AsyncState<PosterTemplate[]> & { reload: () => void };
  editRequest: { form: PosterForm; n: number } | null;
  onCreated: (items: Poster[]) => void;
}) {
  const { t } = useI18n();
  const list = templates.status === 'ready' ? templates.data : null;

  return (
    <section className="card side-card poster-form-card" aria-labelledby="poster-form-title">
      <h2 id="poster-form-title">{t('console.posters.form.title')}</h2>
      {templates.status === 'loading' ? <Loading /> : null}
      {templates.status === 'error' ? (
        errorKind(templates.error) === 'forbidden' ? (
          <p>{t('console.posters.error.forbiddenAction')}</p>
        ) : (
          <ErrorState error={templates.error} onRetry={templates.reload} />
        )
      ) : null}
      {list && list.length === 0 ? <p>{t('console.posters.form.noTemplates')}</p> : null}
      {list && list.length > 0 ? (
        <PosterFormBody
          templates={list}
          session={session}
          editRequest={editRequest}
          onCreated={onCreated}
          onTemplatesGone={templates.reload}
        />
      ) : null}
    </section>
  );
}

function PosterFormBody({
  templates,
  session,
  editRequest,
  onCreated,
  onTemplatesGone,
}: {
  templates: PosterTemplate[];
  session: AdminSession;
  editRequest: { form: PosterForm; n: number } | null;
  onCreated: (items: Poster[]) => void;
  onTemplatesGone: () => void;
}) {
  const { t, tp, localized } = useI18n();
  const { api } = useSignedIn();
  const ids = useId();
  const [form, setForm] = useState<PosterForm>(() => initialPosterForm(templates, session.title));
  const [errors, setErrors] = useState<PosterFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [made, setMade] = useState<number | null>(null);
  const template = templates.find((x) => x.key === form.templateKey);
  const shown = formLanguages(form);
  const anyDemo = templates.some((x) => x.provisional);

  // "Change and make again" on a failed poster puts its choices here and moves to the title.
  useEffect(() => {
    if (!editRequest) return;
    setForm(editRequest.form);
    setErrors({});
    setRefusal(null);
    setMade(null);
    const lead = formLanguages(editRequest.form)[0];
    window.setTimeout(() => document.getElementById(`${ids}-title-${lead ?? 'en'}`)?.focus(), 0);
  }, [editRequest, ids]);

  const patch = (p: Partial<PosterForm>) => {
    setForm((f) => ({ ...f, ...p }));
    setMade(null);
  };
  const problem = (field: keyof PosterFormErrors, max?: number) => {
    const p = errors[field];
    return p ? t(PROBLEM_KEYS[p], max ? { max } : undefined) : null;
  };

  const submit = async () => {
    const checked = buildPosterCreate(form, template);
    setErrors(checked.errors);
    setRefusal(null);
    setMade(null);
    if (!checked.body) return;
    setBusy(true);
    try {
      const res = await api.adminPosters.create({
        params: { sessionId: session.id },
        body: checked.body,
      });
      setMade(res.items.length);
      onCreated(res.items);
    } catch (error) {
      const issues = issuesOf(error);
      if (issues.length > 0) setErrors(serverPosterErrors(issues, form));
      if (errorKind(error) === 'not_found') {
        setErrors({ template: 'notOffered' });
        onTemplatesGone();
      }
      setRefusal(error);
    } finally {
      setBusy(false);
    }
  };

  const refusalKey = (): MessageKey | null => {
    if (!refusal) return null;
    const kind = errorKind(refusal);
    if (kind === 'forbidden') return 'console.posters.error.forbiddenAction';
    if (kind === 'not_found') return 'console.posters.error.templateGone';
    if (kind === 'validation_failed') return 'console.posters.form.rejected';
    if (kind === 'conflict') return 'console.posters.error.createConflict';
    return errorMessageKeyOf(refusal);
  };
  const refusedWith = refusalKey();

  return (
    <form
      className="form poster-form"
      aria-labelledby="poster-form-title"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset
        className="fieldset"
        aria-describedby={errors.template ? `${ids}-tpl-e` : undefined}
      >
        <legend className="field-legend">{t('console.posters.form.template')}</legend>
        {templates.map((x) => (
          <RadioOption
            key={x.key}
            name={`${ids}-template`}
            value={x.key}
            checked={form.templateKey === x.key}
            onChange={() => {
              setForm((f) => withTemplate(f, x));
              setMade(null);
            }}
            label={
              <span className="poster-option">
                {localized(x.name)}
                {x.provisional ? <Badge tone="warning">{t('console.posters.demo')}</Badge> : null}
              </span>
            }
          />
        ))}
        {anyDemo ? <p className="field-hint">{t('console.posters.demo.hint')}</p> : null}
        <FieldsetError
          id={`${ids}-tpl-e`}
          message={
            errors.template === 'notOffered'
              ? t('console.posters.error.templateGone')
              : problem('template')
          }
        />
      </fieldset>

      <fieldset className="fieldset">
        <legend className="field-legend">{t('console.posters.form.language')}</legend>
        {POSTER_LANGUAGES.map((l) => (
          <RadioOption
            key={l}
            name={`${ids}-language`}
            value={l}
            checked={form.language === l}
            onChange={() => patch({ language: l })}
            label={t(POSTER_LANGUAGE_KEYS[l])}
          />
        ))}
      </fieldset>

      <fieldset className="fieldset" aria-describedby={errors.formats ? `${ids}-fmt-e` : undefined}>
        <legend className="field-legend">{t('console.posters.form.formats')}</legend>
        {(template?.formats ?? []).map((f) => (
          <div key={f} className="poster-format">
            <CheckboxField
              label={t(POSTER_FORMAT_KEYS[f])}
              checked={form.formats.includes(f)}
              aria-describedby={`${ids}-${f}-hint`}
              onChange={(e) =>
                patch({
                  formats: e.target.checked
                    ? [...form.formats, f]
                    : form.formats.filter((x) => x !== f),
                })
              }
            />
            <p id={`${ids}-${f}-hint`} className="field-hint">
              {t(POSTER_FORMAT_HINT_KEYS[f])}
            </p>
          </div>
        ))}
        <FieldsetError
          id={`${ids}-fmt-e`}
          message={
            errors.formats === 'required'
              ? t('console.posters.form.error.formats')
              : problem('formats')
          }
        />
      </fieldset>

      {shown.includes('en') ? (
        <TextField
          id={`${ids}-title-en`}
          label={t('console.posters.form.titleEn')}
          hint={t('console.posters.form.titleHint', { max: POSTER_TITLE_MAX })}
          value={form.titleEn}
          onChange={(e) => patch({ titleEn: e.target.value })}
          error={problem('titleEn', POSTER_TITLE_MAX)}
          lang="en"
          dir="ltr"
          required
        />
      ) : null}
      {shown.includes('ur') ? (
        <TextField
          id={`${ids}-title-ur`}
          label={t('console.posters.form.titleUr')}
          hint={t('console.posters.form.titleHint', { max: POSTER_TITLE_MAX })}
          value={form.titleUr}
          onChange={(e) => patch({ titleUr: e.target.value })}
          error={problem('titleUr', POSTER_TITLE_MAX)}
          lang="ur"
          dir="rtl"
          required
        />
      ) : null}
      {shown.includes('en') ? (
        <TextField
          id={`${ids}-details-en`}
          label={t('console.posters.form.detailsEn')}
          hint={t('console.posters.form.detailsHint', { max: POSTER_DETAILS_MAX })}
          value={form.detailsEn}
          onChange={(e) => patch({ detailsEn: e.target.value })}
          error={problem('detailsEn', POSTER_DETAILS_MAX)}
          lang="en"
          dir="ltr"
          optional
        />
      ) : null}
      {shown.includes('ur') ? (
        <TextField
          id={`${ids}-details-ur`}
          label={t('console.posters.form.detailsUr')}
          hint={t('console.posters.form.detailsHint', { max: POSTER_DETAILS_MAX })}
          value={form.detailsUr}
          onChange={(e) => patch({ detailsUr: e.target.value })}
          error={problem('detailsUr', POSTER_DETAILS_MAX)}
          lang="ur"
          dir="rtl"
          optional
        />
      ) : null}

      <SelectField
        id={`${ids}-accent`}
        label={t('console.posters.form.accent')}
        value={form.accent}
        onChange={(e) =>
          patch({ accent: POSTER_ACCENTS.find((a) => a === e.target.value) ?? 'tanzeem' })
        }
        options={POSTER_ACCENTS.map((a) => ({ value: a, label: t(POSTER_ACCENT_KEYS[a]) }))}
      />

      <fieldset className="fieldset">
        <legend className="field-legend">{t('console.posters.form.qr')}</legend>
        {POSTER_QR_TARGETS.map((q) => (
          <RadioOption
            key={q}
            name={`${ids}-qr`}
            value={q}
            checked={form.qrTarget === q}
            onChange={() => patch({ qrTarget: q })}
            label={t(POSTER_QR_KEYS[q])}
            hint={t(POSTER_QR_HINT_KEYS[q])}
          />
        ))}
      </fieldset>

      <p className="poster-note">{t('console.posters.form.fromSession')}</p>

      {refusedWith ? (
        <Banner tone="danger" title={t('console.posters.error.notMade')}>
          {t(refusedWith)}
        </Banner>
      ) : null}
      {made !== null ? (
        <Banner tone="success">{tp('console.posters.form.made', made)}</Banner>
      ) : null}

      <div className="form-actions">
        <Button type="submit" variant="primary" busy={busy}>
          {t('console.posters.form.submit')}
        </Button>
      </div>
    </form>
  );
}
