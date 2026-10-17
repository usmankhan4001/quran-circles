import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  ApiClientError,
  POSTER_ACCENTS,
  POSTER_LANGUAGES,
  POSTER_QR_TARGETS,
  type AdminSession,
  type Poster,
  type PosterLanguage,
  type PosterTemplate,
} from '@qc/contracts';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  EmptyState,
  SegmentedControl,
  Select,
  Tag,
  Text,
  TextField,
  formatNumber,
  spacing,
  type TagKind,
} from '@qc/ui';
import { errorCodeOf, errorMessageKey } from '../../api/errors';
import { useQuery, type QueryResult } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen, ScreenFooter } from '../../components/Screen';
import type { MessageKey } from '../../i18n/translate';
import { pickLocalized } from '../../lib/localized';
import { formatInstantDate } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSession } from '../home/useSession';
import { whenSummary } from '../home/sessionText';
import {
  OUT_OF_DATE_KEYS,
  POSTER_ACCENT_KEYS,
  POSTER_DETAILS_MAX,
  POSTER_FAILURE_KEYS,
  POSTER_FORMAT_HINT_KEYS,
  POSTER_FORMAT_KEYS,
  POSTER_LANGUAGE_KEYS,
  POSTER_QR_KEYS,
  POSTER_STATUS_KEYS,
  POSTER_TITLE_MAX,
  beingReplaced,
  buildPosterCreate,
  formFromPoster,
  formLanguages,
  hasQueued,
  initialPosterForm,
  mergePosters,
  outOfDateKind,
  posterAbilities,
  posterActions,
  posterFileName,
  posterMime,
  serverPosterErrors,
  withTemplate,
  type PosterFieldProblem,
  type PosterForm,
  type PosterFormErrors,
} from './posters';
import { openLink, saveInBrowser, saveRouteFor } from './saveFile';

/** While a poster is being made, the list asks again this often. */
export const POSTER_POLL_MS = 5000;

const STATUS_TAG: Record<Poster['status'], TagKind> = {
  queued: 'neutral',
  ready: 'ok',
  failed: 'alert',
};

export interface PostersScreenProps {
  sessionId: string;
}

/**
 * The posters of one session, from the coordinator's session screen (contract 1.0.0-rc.5): make
 * new ones from a template, see each one's status, regenerate one the session has moved away from,
 * and download the files. The date, time and venue come from the session, never from the form.
 * Shown by `poster.read` and `poster.create` at the session's venue; the API checks again.
 */
export function PostersScreen({ sessionId }: PostersScreenProps) {
  const { t, locale } = useT();
  const nav = useNavigation();
  const session = useSession(sessionId);
  return (
    <Screen
      title={t('admin.posters.title')}
      subtitle={session.data ? pickLocalized(session.data.title, locale) : undefined}
      onBack={nav.back}
      testID="posters"
    >
      <QueryBoundary query={session} testID="posters-session" notFoundIsNotAvailable>
        {(s) => <PostersGate session={s} />}
      </QueryBoundary>
    </Screen>
  );
}

/** Checks the right before anything poster-related is asked of the server. */
function PostersGate({ session }: { session: AdminSession }) {
  const { t } = useT();
  const { principal } = useWorkingScope();
  const can = posterAbilities(principal, session);
  if (!can.read) {
    return (
      <Card variant="flat" testID="posters-forbidden">
        <Text>{t('admin.posters.forbidden')}</Text>
      </Card>
    );
  }
  return <PostersBody session={session} canCreate={can.create} />;
}

type EditRequest = { form: PosterForm; n: number };

function PostersBody({ session, canCreate }: { session: AdminSession; canCreate: boolean }) {
  const { t, locale } = useT();
  const api = useApi();
  const [recent, setRecent] = useState<Poster[]>([]);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [poll, setPoll] = useState(false);
  // Only someone who may make posters may list the templates (`poster.create`).
  const templates = useQuery(
    () => (canCreate ? api.adminPosters.templates().then((r) => r.items) : Promise.resolve([])),
    [canCreate],
  );
  const list = useQuery(
    () => api.adminPosters.list({ params: { sessionId: session.id } }).then((r) => r.items),
    [session.id],
    { refetchIntervalMs: poll ? POSTER_POLL_MS : 0 },
  );
  const posters = useMemo(() => mergePosters(list.data ?? [], recent), [list.data, recent]);
  // Ask again while something is being made, so a finished poster appears on its own.
  useEffect(() => setPoll(hasQueued(posters)), [posters]);

  const templateName = (key: string) => {
    const found = templates.data?.find((x) => x.key === key);
    return found ? pickLocalized(found.name, locale) : key;
  };
  const added = (items: Poster[]) => {
    setRecent((prev) => [...items, ...prev.filter((p) => !items.some((i) => i.id === p.id))]);
    void list.refetch();
  };
  const replaced = beingReplaced(posters);

  return (
    <View style={{ gap: spacing.lg }} testID="posters-body">
      <Card variant="flat" testID="posters-source">
        <View style={{ gap: spacing.xs }}>
          <Text variant="title3" heading={2}>
            {t('admin.posters.source.title')}
          </Text>
          <Text variant="label">{whenSummary(session, t, locale)}</Text>
          <Text>{pickLocalized(session.venue.name, locale)}</Text>
          <Text variant="caption" color="textSecondary">
            {t('admin.posters.source.note')}
          </Text>
        </View>
      </Card>

      <Text variant="title3" heading={2}>
        {t('admin.posters.list.title')}
      </Text>
      {list.status === 'error' && errorCodeOf(list.error) === 'forbidden' ? (
        <Card variant="flat" testID="posters-list-forbidden">
          <Text>{t('admin.posters.forbidden')}</Text>
        </Card>
      ) : (
        <QueryBoundary query={list} testID="posters-list">
          {() =>
            posters.length === 0 ? (
              <EmptyState
                testID="posters-empty"
                title={t('admin.posters.empty.title')}
                description={
                  canCreate ? t('admin.posters.empty.body') : t('admin.posters.empty.readOnly')
                }
              />
            ) : (
              <View style={{ gap: spacing.md }}>
                {posters.map((p) => (
                  <PosterCard
                    key={p.id}
                    poster={p}
                    templateName={templateName(p.templateKey)}
                    actions={posterActions(p, canCreate, replaced)}
                    pending={replaced.has(p.id)}
                    onRegenerated={(fresh) => added([fresh])}
                    onEdit={(old) =>
                      setEditRequest((prev) => ({
                        form: formFromPoster(old),
                        n: (prev?.n ?? 0) + 1,
                      }))
                    }
                  />
                ))}
              </View>
            )
          }
        </QueryBoundary>
      )}

      {canCreate ? (
        <PosterFormSection
          session={session}
          templates={templates}
          editRequest={editRequest}
          onCreated={added}
        />
      ) : null}
    </View>
  );
}

type CardFailure = { kind: 'regenerate' | 'download'; error: unknown };

/** One plain sentence for a refused or failed regenerate or download. */
function failureKey(f: CardFailure): MessageKey {
  const code = errorCodeOf(f.error);
  if (code === 'forbidden') return 'admin.posters.error.forbiddenAction';
  if (code === 'conflict')
    return f.kind === 'regenerate'
      ? 'admin.posters.error.regenerateConflict'
      : 'admin.posters.error.downloadConflict';
  if (code === 'not_found') return 'admin.posters.error.posterGone';
  return errorMessageKey(f.error);
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
  const { t, locale } = useT();
  const api = useApi();
  const [busy, setBusy] = useState<'regenerate' | 'download' | null>(null);
  const [failure, setFailure] = useState<CardFailure | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const title = p.fields.title[p.locale] ?? p.fields.title.en ?? p.fields.title.ur ?? '';
  const outOfDate = p.outOfDate ? outOfDateKind(p.outOfDate.reasons) : null;
  const pdf = posterMime(p.format) === 'application/pdf';
  const id = `poster-${p.id}`;

  const regenerate = async () => {
    setBusy('regenerate');
    setFailure(null);
    setNotice(null);
    try {
      onRegenerated(await api.adminPosters.regenerate({ params: { posterId: p.id } }));
    } catch (error) {
      setFailure({ kind: 'regenerate', error });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setFailure(null);
    setNotice(null);
    const route = saveRouteFor(p.fileUrl);
    if (route === 'none') {
      setNotice('admin.posters.download.elsewhere');
      return;
    }
    setBusy('download');
    try {
      if (route === 'link' && p.fileUrl) await openLink(p.fileUrl);
      else {
        const bytes = await api.adminPosters.file({ params: { posterId: p.id } });
        saveInBrowser(posterFileName(p), bytes, posterMime(p.format));
      }
      setNotice('admin.posters.downloaded');
    } catch (error) {
      setFailure({ kind: 'download', error });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card testID={id}>
      <View style={{ gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          <Text variant="label" heading={3}>
            {t('admin.posters.card.title', {
              template: templateName,
              format: t(POSTER_FORMAT_KEYS[p.format]),
            })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <Tag
              testID={`${id}-status`}
              label={t(POSTER_STATUS_KEYS[p.status])}
              kind={STATUS_TAG[p.status]}
            />
            {outOfDate ? <Tag label={t('admin.posters.outOfDate.tag')} kind="gilt" /> : null}
          </View>
        </View>
        {title ? (
          <Text variant="title3" lang={p.locale}>
            {title}
          </Text>
        ) : null}
        <Text variant="caption" color="textSecondary">
          {t('admin.posters.card.meta', {
            language: t(POSTER_LANGUAGE_KEYS[p.language]),
            date: formatInstantDate(p.createdAt, locale),
          })}
        </Text>

        {outOfDate ? (
          <Banner
            testID={`${id}-out-of-date`}
            kind="change"
            title={t('admin.posters.outOfDate.title')}
            message={
              pending
                ? `${t(OUT_OF_DATE_KEYS[outOfDate])} ${t('admin.posters.replacing')}`
                : t(OUT_OF_DATE_KEYS[outOfDate])
            }
          />
        ) : null}
        {!outOfDate && pending ? (
          <Text variant="caption" color="textSecondary">
            {t('admin.posters.replacing')}
          </Text>
        ) : null}
        {p.status === 'queued' ? (
          <Text variant="caption" color="textSecondary" testID={`${id}-queued`}>
            {p.replacesPosterId ? t('admin.posters.queued.again') : t('admin.posters.queued')}
          </Text>
        ) : null}
        {p.status === 'failed' ? (
          <Text color="textDanger" testID={`${id}-failure`}>
            {t(POSTER_FAILURE_KEYS[p.failureCode ?? 'render_failed'])}
          </Text>
        ) : null}
        {failure ? (
          <Text color="textDanger" testID={`${id}-error`}>
            {t(failureKey(failure))}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="caption" color="textSecondary" testID={`${id}-notice`}>
            {t(notice)}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {actions.regenerate ? (
            <Button
              testID={`${id}-regenerate`}
              label={
                p.status === 'failed' ? t('admin.posters.retry') : t('admin.posters.regenerate')
              }
              variant={outOfDate ? 'primary' : 'secondary'}
              loading={busy === 'regenerate'}
              disabled={busy !== null}
              onPress={() => void regenerate()}
            />
          ) : null}
          {actions.download ? (
            <Button
              testID={`${id}-download`}
              label={pdf ? t('admin.posters.download.pdf') : t('admin.posters.download.png')}
              variant="secondary"
              loading={busy === 'download'}
              disabled={busy !== null}
              onPress={() => void download()}
            />
          ) : null}
          {actions.edit ? (
            <Button
              testID={`${id}-edit`}
              label={t('admin.posters.editAgain')}
              variant="tertiary"
              onPress={() => onEdit(p)}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

// The form --------------------------------------------------------------------------------

const PROBLEM_KEYS: Record<PosterFieldProblem, MessageKey> = {
  required: 'admin.posters.form.error.required',
  tooLong: 'admin.posters.form.error.tooLong',
  invalid: 'admin.posters.form.error.invalid',
  notOffered: 'admin.posters.form.error.notOffered',
};

function PosterFormSection({
  session,
  templates,
  editRequest,
  onCreated,
}: {
  session: AdminSession;
  templates: QueryResult<PosterTemplate[]>;
  editRequest: EditRequest | null;
  onCreated: (items: Poster[]) => void;
}) {
  const { t } = useT();
  return (
    <View style={{ gap: spacing.md }} testID="poster-form-section">
      <Text variant="title3" heading={2}>
        {t('admin.posters.form.title')}
      </Text>
      {templates.status === 'error' && errorCodeOf(templates.error) === 'forbidden' ? (
        <Text testID="poster-templates-forbidden">{t('admin.posters.error.forbiddenAction')}</Text>
      ) : (
        <QueryBoundary query={templates} testID="poster-templates">
          {(items) =>
            items.length === 0 ? (
              <Text testID="poster-templates-none">{t('admin.posters.form.noTemplates')}</Text>
            ) : (
              <PosterFormBody
                templates={items}
                session={session}
                editRequest={editRequest}
                onCreated={onCreated}
                onTemplatesGone={() => void templates.refetch()}
              />
            )
          }
        </QueryBoundary>
      )}
    </View>
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
  editRequest: EditRequest | null;
  onCreated: (items: Poster[]) => void;
  onTemplatesGone: () => void;
}) {
  const { t, locale } = useT();
  const api = useApi();
  const [form, setForm] = useState<PosterForm>(() => initialPosterForm(templates, session.title));
  const [errors, setErrors] = useState<PosterFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [made, setMade] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const template = templates.find((x) => x.key === form.templateKey);
  const shown = formLanguages(form);

  // "Change and make again" on a failed poster puts its choices here.
  useEffect(() => {
    if (!editRequest) return;
    setForm(editRequest.form);
    setErrors({});
    setRefusal(null);
    setMade(null);
    setEditing(true);
  }, [editRequest]);

  const patch = (p: Partial<PosterForm>) => {
    setForm((f) => ({ ...f, ...p }));
    setMade(null);
  };
  const problem = (field: keyof PosterFormErrors, max?: number): string | undefined => {
    const p = errors[field];
    if (!p) return undefined;
    if (field === 'formats' && p === 'required') return t('admin.posters.form.error.formats');
    if (field === 'template' && p === 'notOffered') return t('admin.posters.error.templateGone');
    return t(PROBLEM_KEYS[p], max ? { max: formatNumber(max, locale) } : undefined);
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
      setEditing(false);
      onCreated(res.items);
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === 'validation_failed') {
        const issues = error instanceof ApiClientError ? (error.issues ?? []) : [];
        setErrors(serverPosterErrors(issues, form));
      }
      if (code === 'not_found') {
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
    const code = errorCodeOf(refusal);
    if (code === 'forbidden') return 'admin.posters.error.forbiddenAction';
    if (code === 'not_found') return 'admin.posters.error.templateGone';
    if (code === 'validation_failed') return 'admin.posters.form.rejected';
    if (code === 'conflict') return 'admin.posters.error.createConflict';
    return errorMessageKey(refusal);
  };
  const refusedWith = refusalKey();

  const languageOptions = POSTER_LANGUAGES.map((l) => ({
    value: l,
    label: t(POSTER_LANGUAGE_KEYS[l]),
  }));

  return (
    <View style={{ gap: spacing.lg }} testID="poster-form">
      {editing ? (
        <Text variant="caption" color="textSecondary" testID="poster-form-editing">
          {t('admin.posters.form.editing')}
        </Text>
      ) : null}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label">{t('admin.posters.form.template')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {templates.map((x) => (
              <View
                key={x.key}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
              >
                <Chip
                  testID={`poster-template-${x.key}`}
                  label={pickLocalized(x.name, locale)}
                  selected={form.templateKey === x.key}
                  onPress={() => {
                    setForm((f) => withTemplate(f, x));
                    setMade(null);
                  }}
                />
                {x.provisional ? (
                  <Tag
                    testID={`poster-template-${x.key}-demo`}
                    label={t('admin.posters.demo')}
                    kind="gilt"
                  />
                ) : null}
              </View>
            ))}
          </View>
          {templates.some((x) => x.provisional) ? (
            <Text variant="caption" color="textSecondary">
              {t('admin.posters.demo.hint')}
            </Text>
          ) : null}
          {problem('template') ? (
            <Text variant="caption" color="textDanger" testID="poster-template-error">
              {problem('template')}
            </Text>
          ) : null}
        </View>
      </Card>

      <Select<PosterLanguage>
        testID="poster-language"
        label={t('admin.posters.form.language')}
        options={languageOptions}
        value={form.language}
        onChange={(language) => patch({ language })}
        required
      />

      <Card>
        <View style={{ gap: spacing.xs }}>
          <Text variant="label">{t('admin.posters.form.formats')}</Text>
          {(template?.formats ?? []).map((f) => (
            <Checkbox
              key={f}
              testID={`poster-format-${f}`}
              label={t(POSTER_FORMAT_KEYS[f])}
              description={t(POSTER_FORMAT_HINT_KEYS[f])}
              checked={form.formats.includes(f)}
              onChange={(on) =>
                patch({
                  formats: on ? [...form.formats, f] : form.formats.filter((x) => x !== f),
                })
              }
            />
          ))}
          {problem('formats') ? (
            <Text variant="caption" color="textDanger" testID="poster-formats-error">
              {problem('formats')}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          {shown.includes('en') ? (
            <TextField
              testID="poster-title-en"
              label={t('admin.posters.form.titleEn')}
              helper={t('admin.posters.form.titleHint', {
                max: formatNumber(POSTER_TITLE_MAX, locale),
              })}
              value={form.titleEn}
              onChangeText={(titleEn) => patch({ titleEn })}
              error={problem('titleEn', POSTER_TITLE_MAX)}
              contentDirection="ltr"
              required
            />
          ) : null}
          {shown.includes('ur') ? (
            <TextField
              testID="poster-title-ur"
              label={t('admin.posters.form.titleUr')}
              helper={t('admin.posters.form.titleHint', {
                max: formatNumber(POSTER_TITLE_MAX, locale),
              })}
              value={form.titleUr}
              onChangeText={(titleUr) => patch({ titleUr })}
              error={problem('titleUr', POSTER_TITLE_MAX)}
              contentDirection="rtl"
              required
            />
          ) : null}
          {shown.includes('en') ? (
            <TextField
              testID="poster-details-en"
              label={t('admin.posters.form.detailsEn')}
              helper={t('admin.posters.form.detailsHint', {
                max: formatNumber(POSTER_DETAILS_MAX, locale),
              })}
              value={form.detailsEn}
              onChangeText={(detailsEn) => patch({ detailsEn })}
              error={problem('detailsEn', POSTER_DETAILS_MAX)}
              contentDirection="ltr"
            />
          ) : null}
          {shown.includes('ur') ? (
            <TextField
              testID="poster-details-ur"
              label={t('admin.posters.form.detailsUr')}
              helper={t('admin.posters.form.detailsHint', {
                max: formatNumber(POSTER_DETAILS_MAX, locale),
              })}
              value={form.detailsUr}
              onChangeText={(detailsUr) => patch({ detailsUr })}
              error={problem('detailsUr', POSTER_DETAILS_MAX)}
              contentDirection="rtl"
            />
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="label">{t('admin.posters.form.accent')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {POSTER_ACCENTS.map((a) => (
              <Chip
                key={a}
                testID={`poster-accent-${a}`}
                label={t(POSTER_ACCENT_KEYS[a])}
                selected={form.accent === a}
                onPress={() => patch({ accent: a })}
              />
            ))}
          </View>
          <Text variant="label">{t('admin.posters.form.qr')}</Text>
          <SegmentedControl
            testID="poster-qr"
            accessibilityLabel={t('admin.posters.form.qr')}
            options={POSTER_QR_TARGETS.map((q) => ({ value: q, label: t(POSTER_QR_KEYS[q]) }))}
            value={form.qrTarget}
            onChange={(qrTarget) => patch({ qrTarget })}
          />
          <Text variant="caption" color="textSecondary">
            {form.qrTarget === 'register'
              ? t('admin.posters.qr.register.hint')
              : t('admin.posters.qr.session.hint')}
          </Text>
        </View>
      </Card>

      <Text variant="caption" color="textSecondary">
        {t('admin.posters.form.fromSession')}
      </Text>
      {refusedWith ? (
        <Card variant="flat" testID="poster-form-refused">
          <View style={{ gap: spacing.xxs }}>
            <Text variant="label" color="textDanger">
              {t('admin.posters.error.notMade')}
            </Text>
            <Text color="textDanger">{t(refusedWith)}</Text>
          </View>
        </Card>
      ) : null}
      {made !== null ? (
        <Text testID="poster-form-made" color="textSecondary">
          {t.plural('admin.posters.form.made', made)}
        </Text>
      ) : null}
      <ScreenFooter>
        <Button
          testID="poster-submit"
          label={t('admin.posters.form.submit')}
          size="large"
          fullWidth
          loading={busy}
          onPress={() => void submit()}
        />
      </ScreenFooter>
    </View>
  );
}
