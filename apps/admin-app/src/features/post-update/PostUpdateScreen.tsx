import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { AdminSession, Locale } from '@qc/contracts';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  Select,
  SegmentedControl,
  Switch,
  Text,
  TextField,
  spacing,
} from '@qc/ui';
import { rejectedFields, serverFieldErrors } from '../../api/errors';
import { useMutation, useQuery } from '../../api/query';
import { hasMessage, type Translator } from '../../i18n/translate';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { BilingualField } from '../../components/BilingualField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen, ScreenFooter } from '../../components/Screen';
import { pickLocalized } from '../../lib/localized';
import { useNavigation } from '../../navigation/NavigationContext';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import {
  applyTemplate,
  emptyPostUpdateForm,
  validatePostUpdate,
  type PostUpdateErrors,
  type PostUpdateForm,
} from './form';
import {
  buildScopeOptions,
  defaultScopeChoice,
  type PostLevel,
  type ScopeOptions,
  type VenueChoice,
} from './scopes';
import { groupTemplates, type TemplateChoice } from './templates';
import {
  PREVIEW_DELAY_MS,
  useRecipientPreview,
  type RecipientPreview,
} from './useRecipientPreview';

/** Where the server's validation paths land on this form. */
const POST_FIELDS = {
  scope: 'scope',
  title: 'title',
  body: 'body',
  templateKey: 'template',
} as const;

export interface PostUpdateScreenProps {
  /** Set when the update is about one session. */
  sessionId?: string;
  /** How long the draft must stay still before the recipient count is asked for. Tests shorten it. */
  previewDelayMs?: number;
}

interface Loaded {
  options: ScopeOptions;
  venues: VenueChoice[];
  templates: TemplateChoice[];
  session: AdminSession | null;
}

/**
 * Post an update: pick where it goes (only places the role allows), write or start from an
 * approved template, preview what people will see, send, and read the recipient count back.
 */
export function PostUpdateScreen({
  sessionId,
  previewDelayMs = PREVIEW_DELAY_MS,
}: PostUpdateScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal, filter } = useWorkingScope();

  const query = useQuery<Loaded>(async () => {
    const [cities, venues, templates, session] = await Promise.all([
      api.places.cities(),
      api.adminVenues.list({ query: { ...filter, limit: 100 } }),
      // Templates are optional: without them the coordinator writes the message.
      api.adminTemplates.list().catch(() => ({ items: [] })),
      sessionId ? api.adminSessions.get({ params: { sessionId } }) : Promise.resolve(null),
    ]);
    const cityChoices = cities.items.map((c) => ({
      id: c.id,
      label: pickLocalized(c.name, locale),
    }));
    const venueChoices = venues.items.map((v) => ({
      id: v.id,
      cityId: v.cityId,
      label: pickLocalized(v.name, locale),
    }));
    return {
      options: buildScopeOptions(principal, cityChoices, venueChoices),
      venues: venueChoices,
      templates: groupTemplates(templates.items),
      session,
    };
  }, [sessionId, filter.cityId, filter.venueId, locale]);

  return (
    <Screen
      title={t('admin.postUpdate.title')}
      subtitle={sessionId ? undefined : t('admin.postUpdate.subtitle')}
      onBack={nav.back}
      testID="post-update"
    >
      <QueryBoundary query={query} testID="post-update-data" notFoundIsNotAvailable>
        {(loaded) => (
          <PostUpdateFlow
            loaded={loaded}
            sessionId={sessionId ?? null}
            previewDelayMs={previewDelayMs}
          />
        )}
      </QueryBoundary>
    </Screen>
  );
}

function PostUpdateFlow({
  loaded,
  sessionId,
  previewDelayMs,
}: {
  loaded: Loaded;
  sessionId: string | null;
  previewDelayMs: number;
}) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal, active } = useWorkingScope();
  const { options, venues, templates, session } = loaded;

  const [form, setForm] = useState<PostUpdateForm>(() => {
    const choice = defaultScopeChoice(active, options);
    const base = emptyPostUpdateForm(choice, sessionId);
    if (session) {
      const venue = options.venues.find((v) => v.id === session.venueId);
      if (venue) return { ...base, level: 'venue', cityId: null, venueId: venue.id };
    }
    return base;
  });
  const [errors, setErrors] = useState<PostUpdateErrors>({});
  const [step, setStep] = useState<'compose' | 'preview' | 'done'>('compose');
  const [confirming, setConfirming] = useState(false);
  const post = useMutation(api.adminUpdates.post);

  const template = templates.find((x) => x.key === form.templateKey) ?? null;
  // The draft as it would be sent; while it is complete, the count of who it reaches is kept fresh.
  const draft = validatePostUpdate(form, principal, venues, template);
  const reach = useRecipientPreview(draft.body, previewDelayMs);
  const serverRejected = rejectedFields(post.error, POST_FIELDS).length > 0;
  const shown = { ...serverFieldErrors(post.error, POST_FIELDS), ...errors };

  // When the server rejects a field, go back to the form so the field can be seen and fixed.
  useEffect(() => {
    if (serverRejected && step === 'preview') setStep('compose');
  }, [serverRejected, step]);
  const patch = (p: Partial<PostUpdateForm>) => setForm((f) => ({ ...f, ...p }));
  const noPlace = options.levels.length === 0 || (session !== null && form.venueId === null);

  const scopeText = useMemo(() => {
    if (form.level === 'national') return t('admin.postUpdate.reach.national');
    if (form.level === 'city') {
      const city = options.cities.find((c) => c.id === form.cityId);
      return t('admin.postUpdate.reach.city', { name: city?.label ?? '' });
    }
    const venue = options.venues.find((v) => v.id === form.venueId);
    return t('admin.postUpdate.reach.venue', { name: venue?.label ?? '' });
  }, [form.level, form.cityId, form.venueId, options, t]);

  const toPreview = () => {
    setErrors(draft.errors);
    if (draft.body) {
      post.reset();
      setStep('preview');
    }
  };

  const send = async () => {
    if (!draft.body) {
      setErrors(draft.errors);
      setConfirming(false);
      setStep('compose');
      return;
    }
    const posted = await post.run({ body: draft.body });
    // On a refusal the sheet closes and the message shows on the page (the sheet takes text only).
    setConfirming(false);
    if (posted) setStep('done');
  };

  if (noPlace) {
    return (
      <Card variant="flat" testID="post-update-no-scope">
        <Text>{t('admin.postUpdate.noScope')}</Text>
      </Card>
    );
  }

  if (step === 'done' && post.data) {
    return (
      <View style={{ gap: spacing.lg }} testID="post-update-done">
        <Card variant="flat">
          <View style={{ gap: spacing.sm }}>
            <Text variant="title3" heading={2}>
              {t('admin.postUpdate.sentTitle')}
            </Text>
            <Text testID="post-update-recipients">
              {t.plural('admin.postUpdate.sentTo', post.data.recipients)}
            </Text>
            <Text variant="caption" color="textSecondary">
              {form.notify
                ? t('admin.postUpdate.sentNotified')
                : t('admin.postUpdate.sentFeedOnly')}
            </Text>
          </View>
        </Card>
        <ScreenFooter>
          <Button label={t('admin.common.done')} size="large" fullWidth onPress={nav.back} />
          <Button
            label={t('admin.postUpdate.another')}
            variant="secondary"
            fullWidth
            onPress={() => {
              post.reset();
              setForm(emptyPostUpdateForm(defaultScopeChoice(active, options), sessionId));
              setStep('compose');
            }}
          />
        </ScreenFooter>
      </View>
    );
  }

  if (step === 'preview') {
    const previewTitle = pickLocalizedPair(form.title, locale);
    const previewBody = pickLocalizedPair(form.body, locale);
    return (
      <View style={{ gap: spacing.lg }} testID="post-update-preview-step">
        <Text variant="title3" heading={2}>
          {t('admin.postUpdate.preview')}
        </Text>
        <Card variant="flat">
          <View style={{ gap: spacing.xs }}>
            <Text variant="caption" color="textSecondary">
              {t('admin.postUpdate.whoWillSee')}
            </Text>
            <Text testID="post-update-reach">{scopeText}</Text>
            <ReachCount reach={reach} />
            <Text variant="caption" color="textSecondary">
              {form.notify ? t('admin.postUpdate.willNotify') : t('admin.postUpdate.feedOnly')}
            </Text>
          </View>
        </Card>
        <Card>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label" lang={previewTitle.lang}>
              {previewTitle.text}
            </Text>
            <Text lang={previewBody.lang}>{previewBody.text}</Text>
          </View>
        </Card>
        <ErrorNotice error={confirming ? null : post.error} onDismiss={post.reset} />
        <ScreenFooter>
          <Button
            testID="post-update-send"
            label={t('admin.postUpdate.send')}
            size="large"
            fullWidth
            loading={post.status === 'running'}
            onPress={() => {
              post.reset();
              setConfirming(true);
            }}
          />
          <Button
            testID="post-update-edit"
            label={t('admin.postUpdate.edit')}
            variant="tertiary"
            fullWidth
            disabled={post.status === 'running'}
            onPress={() => {
              post.reset();
              setStep('compose');
            }}
          />
        </ScreenFooter>
        <ConfirmSheet
          testID="post-update-confirm"
          visible={confirming}
          title={
            reach.status === 'ready' && reach.recipients !== null
              ? t.plural('admin.postUpdate.confirmTo', reach.recipients)
              : t('admin.postUpdate.confirmNoCount')
          }
          message={t('admin.postUpdate.confirm.body')}
          confirmLabel={t('admin.postUpdate.confirm.send')}
          cancelLabel={t('admin.postUpdate.confirm.cancel')}
          busy={post.status === 'running'}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void send()}
        />
      </View>
    );
  }

  const levelLabels: Record<PostLevel, string> = {
    national: t('admin.postUpdate.level.national'),
    city: t('admin.postUpdate.level.city'),
    venue: t('admin.postUpdate.level.venue'),
  };

  return (
    <View style={{ gap: spacing.lg }} testID="post-update-compose">
      {session ? (
        <Card variant="flat">
          <Text variant="caption" color="textSecondary">
            {t('admin.postUpdate.about')}
          </Text>
          <Text variant="label">{pickLocalized(session.title, locale)}</Text>
          <ReachCount reach={reach} />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" color="textSecondary" heading={2}>
            {t('admin.postUpdate.whoFor')}
          </Text>
          <Card>
            <View style={{ gap: spacing.md }}>
              {options.levels.length > 1 ? (
                <SegmentedControl
                  accessibilityLabel={t('admin.postUpdate.whoFor')}
                  value={form.level}
                  onChange={(level) =>
                    patch({
                      level,
                      cityId: level === 'city' ? (options.cities[0]?.id ?? null) : null,
                      venueId: level === 'venue' ? (options.venues[0]?.id ?? null) : null,
                    })
                  }
                  options={options.levels.map((l) => ({ value: l, label: levelLabels[l] }))}
                />
              ) : null}
              {form.level === 'city' ? (
                <Select
                  testID="post-update-city"
                  label={levelLabels.city}
                  required
                  value={form.cityId ?? undefined}
                  onChange={(cityId) => patch({ cityId })}
                  options={options.cities.map((c) => ({ value: c.id, label: c.label }))}
                  error={shown.scope ? t(shown.scope) : undefined}
                />
              ) : null}
              {form.level === 'venue' ? (
                <Select
                  testID="post-update-venue"
                  label={levelLabels.venue}
                  required
                  value={form.venueId ?? undefined}
                  onChange={(venueId) => patch({ venueId })}
                  options={options.venues.map((v) => ({ value: v.id, label: v.label }))}
                  error={shown.scope ? t(shown.scope) : undefined}
                />
              ) : null}
              <Text variant="caption" color="textSecondary">
                {scopeText}
              </Text>
              <ReachCount reach={reach} />
            </View>
          </Card>
        </View>
      )}

      {templates.length > 0 ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Select
              testID="post-update-template"
              label={t('admin.postUpdate.template.label')}
              helper={t('admin.postUpdate.template.help')}
              value={form.templateKey ?? ''}
              onChange={(key) => {
                const next = templates.find((x) => x.key === key) ?? null;
                const values = next
                  ? suggestedValues(next, session, locale, form.templateValues)
                  : {};
                setForm((f) => applyTemplate({ ...f, templateValues: values }, next));
              }}
              options={[
                { value: '', label: t('admin.postUpdate.template.none') },
                ...templates.map((x) => ({ value: x.key, label: templateLabel(t, x.key) })),
              ]}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Chip
                label={t('admin.postUpdate.template.none')}
                selected={!form.templateKey}
                onPress={() => setForm((f) => applyTemplate({ ...f, templateValues: {} }, null))}
              />
              {templates.map((x) => (
                <Chip
                  key={x.key}
                  label={templateLabel(t, x.key)}
                  selected={form.templateKey === x.key}
                  onPress={() => {
                    const values = suggestedValues(x, session, locale, form.templateValues);
                    setForm((f) => applyTemplate({ ...f, templateValues: values }, x));
                  }}
                />
              ))}
            </View>
            {template
              ? template.variables.map((name) => (
                  <TextField
                    key={name}
                    testID={`post-update-var-${name}`}
                    label={variableLabel(t, name)}
                    required
                    value={form.templateValues[name] ?? ''}
                    onChangeText={(value) =>
                      setForm((f) =>
                        applyTemplate(
                          { ...f, templateValues: { ...f.templateValues, [name]: value } },
                          template,
                        ),
                      )
                    }
                    error={shown.template ? t(shown.template) : undefined}
                  />
                ))
              : null}
          </View>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="label" color="textSecondary" heading={2}>
          {t('admin.postUpdate.message')}
        </Text>
        <Card>
          <View style={{ gap: spacing.md }}>
            <BilingualField
              testID="post-update-title"
              label={t('admin.postUpdate.title.label')}
              value={form.title}
              onChange={(title) => patch({ title })}
              required
              error={shown.title ? t(shown.title) : undefined}
            />
            <BilingualField
              testID="post-update-body"
              label={t('admin.postUpdate.body.label')}
              value={form.body}
              onChange={(body) => patch({ body })}
              multiline
              required
              error={shown.body ? t(shown.body) : undefined}
            />
            <Text variant="caption" color="textSecondary">
              {t('admin.postUpdate.language.help')}
            </Text>
          </View>
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="label" color="textSecondary" heading={2}>
          {t('admin.postUpdate.sendBy')}
        </Text>
        <Card>
          <Switch
            testID="post-update-notify"
            label={t('admin.postUpdate.notify.label')}
            description={t('admin.postUpdate.notify.help')}
            value={form.notify}
            onValueChange={(notify) => patch({ notify })}
          />
        </Card>
      </View>
      <ErrorNotice error={post.error} onDismiss={post.reset} />
      <ScreenFooter>
        <Button
          testID="post-update-preview"
          label={t('admin.postUpdate.preview')}
          size="large"
          fullWidth
          onPress={toPreview}
        />
      </ScreenFooter>
    </View>
  );
}

/** "This will reach 37 people", once the server has counted. Nothing while there is no full draft. */
function ReachCount({ reach }: { reach: RecipientPreview }) {
  const { t } = useT();
  if (reach.status === 'counting') {
    return (
      <Text variant="caption" color="textSecondary" testID="post-update-counting">
        {t('admin.postUpdate.counting')}
      </Text>
    );
  }
  if (reach.status !== 'ready' || reach.recipients === null) return null;
  return (
    <Text variant="label" color="textAccent" testID="post-update-count">
      {t.plural('admin.postUpdate.willReach', reach.recipients)}
    </Text>
  );
}

function templateLabel(t: Translator, key: string): string {
  const id = `admin.postUpdate.templateName.${key}`;
  return hasMessage(id) ? t(id) : key;
}

function variableLabel(t: Translator, name: string): string {
  const id = `admin.postUpdate.var.${name}`;
  return hasMessage(id) ? t(id) : name;
}

/** Previews in the person's language when there is text in it, else in the other. */
function pickLocalizedPair(
  v: { en: string; ur: string },
  locale: Locale,
): { text: string; lang: 'en' | 'ur' } {
  const preferred = locale === 'ur' ? v.ur.trim() : v.en.trim();
  if (preferred) return { text: preferred, lang: locale };
  const other: 'en' | 'ur' = locale === 'ur' ? 'en' : 'ur';
  return { text: (other === 'ur' ? v.ur : v.en).trim(), lang: other };
}

/** Blanks the app can guess from the session: its title and venue. The coordinator can change them. */
function suggestedValues(
  template: TemplateChoice,
  session: AdminSession | null,
  locale: Locale,
  current: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of template.variables) {
    const existing = current[name];
    if (existing) out[name] = existing;
    else if (name === 'sessionTitle' && session) out[name] = pickLocalized(session.title, locale);
    else if (name === 'venueName' && session) out[name] = pickLocalized(session.venue.name, locale);
  }
  return out;
}
