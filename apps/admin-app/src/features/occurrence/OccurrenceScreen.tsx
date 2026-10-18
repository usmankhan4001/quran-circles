import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { AdminOccurrence } from '@qc/contracts';
import {
  Button,
  Card,
  ConfirmSheet,
  Select,
  SegmentedControl,
  Switch,
  Tag,
  Text,
  TextField,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import { ApiClientError } from '@qc/contracts';
import { serverFieldErrors } from '../../api/errors';
import { useMutation, useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { ErrorNotice } from '../../components/ErrorNotice';
import { NotAvailable } from '../../components/NotAvailable';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen, ScreenFooter } from '../../components/Screen';
import { formatInstantDate, formatInstantTime, pkDayRange } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { sessionNotAvailable, useSession } from '../home/useSession';
import {
  initialOccurrenceForm,
  isPast,
  validateOccurrence,
  type OccurrenceErrors,
  type OccurrenceForm,
  type PortionChoice,
} from './form';

export interface OccurrenceScreenProps {
  sessionId: string;
  occurrenceId: string;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the server's validation paths land on this form. */
const OCCURRENCE_FIELDS = {
  'portion.para': 'para',
  'portion.surah': 'surah',
  'portion.fromAyah': 'ayahs',
  'portion.toAyah': 'ayahs',
  'portion.title': 'lesson',
  portionLabel: 'portionLabel',
  recapNote: 'recap',
} as const;

/** Set the portion and the recap of one date, or cancel just that date. */
export function OccurrenceScreen({
  sessionId,
  occurrenceId,
  now = new Date(),
}: OccurrenceScreenProps) {
  const { t } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const session = useSession(sessionId);

  const query = useQuery<{ occurrence: AdminOccurrence; upcoming: AdminOccurrence[] }>(async () => {
    const res = await api.adminSessions.occurrences({
      params: { sessionId },
      query: { from: new Date(now.getTime() - 60 * DAY_MS).toISOString(), limit: 100 },
    });
    const found = res.items.find((o) => o.id === occurrenceId);
    if (!found) throw new ApiClientError(404, 'not_found', null);
    const from = pkDayRange(now).from;
    const upcoming = res.items.filter((o) => o.startsAt >= from).slice(0, 3);
    return { occurrence: found, upcoming };
  }, [sessionId, occurrenceId]);

  const can = session.data ? sessionAbilities(principal, session.data) : null;
  const allowed = can ? can.editOccurrence : true;

  return (
    <Screen
      title={t('admin.occurrence.screenTitle')}
      onBack={nav.back}
      actions={
        can?.changeSchedule ? (
          <Pressable
            testID="occurrence-weekly"
            role="link"
            accessibilityLabel={t('admin.home.changeTime')}
            onPress={() => nav.push(routes.schedule(sessionId))}
            hitSlop={spacing.md}
          >
            <Text variant="caption" color="textAccent" strong decorative>
              {t('admin.occurrence.weekly')}
            </Text>
          </Pressable>
        ) : undefined
      }
      testID="occurrence"
    >
      {sessionNotAvailable(session) ? (
        <NotAvailable testID="occurrence-not-available" />
      ) : !allowed ? (
        <Card variant="flat" testID="occurrence-forbidden">
          <Text>{t('errors.forbidden')}</Text>
        </Card>
      ) : (
        <QueryBoundary query={query} testID="occurrence-data" notFoundIsNotAvailable>
          {({ occurrence, upcoming }) => (
            <View style={{ gap: spacing.lg }}>
              <Upcoming
                sessionId={sessionId}
                current={occurrence.id}
                items={
                  upcoming.some((o) => o.id === occurrence.id)
                    ? upcoming
                    : [occurrence, ...upcoming.slice(0, 2)]
                }
              />
              <OccurrenceFlow
                key={occurrence.id}
                occurrence={occurrence}
                now={now}
                teacher={session.data?.circle?.teacherName ?? null}
              />
            </View>
          )}
        </QueryBoundary>
      )}
    </Screen>
  );
}

/**
 * D17 "Upcoming occurrences": the next dates as cards; the one being edited has an emerald edge and
 * an "Editing" tag, the others an "Edit" link that opens their own editor.
 */
function Upcoming({
  sessionId,
  current,
  items,
}: {
  sessionId: string;
  current: string;
  items: AdminOccurrence[];
}) {
  const { t, locale } = useT();
  const { colors, mode } = useTheme();
  const nav = useNavigation();
  return (
    <View style={{ gap: spacing.sm }} testID="occurrence-upcoming">
      <Text variant="body" strong heading={2}>
        {t('admin.occurrence.upcoming')}
      </Text>
      {items.map((o) => {
        const on = o.id === current;
        const title = [formatInstantDate(o.startsAt, locale), o.portionLabel]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={o.id}
            testID={`occurrence-upcoming-${o.id}`}
            role="button"
            aria-current={on ? 'true' : undefined}
            accessibilityLabel={`${title}, ${formatInstantTime(o.startsAt, locale)}`}
            disabled={on}
            onPress={() => nav.replace(routes.occurrence(sessionId, o.id))}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              minHeight: minTouchTarget + spacing.sm,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radii.lg,
              borderWidth: on ? 1.5 : 1,
              borderColor: on
                ? colors.accent
                : mode === 'highContrast'
                  ? colors.borderStrong
                  : colors.hairline,
              backgroundColor: on ? colors.accentSubtle : colors.surface,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="caption" strong decorative>
                {title}
              </Text>
              <Text variant="caption" color="textSecondary" decorative>
                {formatInstantTime(o.startsAt, locale)}
                {o.status === 'cancelled' ? ` · ${t('admin.home.cancelled')}` : ''}
              </Text>
            </View>
            {on ? (
              <Tag label={t('admin.occurrence.editing')} kind="ok" />
            ) : (
              <Text variant="caption" color="textSecondary" strong decorative>
                {t('admin.occurrence.edit')}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function OccurrenceFlow({
  occurrence,
  now,
  teacher,
}: {
  occurrence: AdminOccurrence;
  now: Date;
  teacher: string | null;
}) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const [form, setForm] = useState<OccurrenceForm>(() => initialOccurrenceForm(occurrence, locale));
  const [errors, setErrors] = useState<OccurrenceErrors>({});
  const [confirming, setConfirming] = useState(false);
  const save = useMutation(api.adminOccurrences.update);
  // What the form found, else what the server rejected (`ApiClientError.issues`).
  const shown = { ...serverFieldErrors(save.error, OCCURRENCE_FIELDS), ...errors };
  const past = isPast(occurrence, now);
  const patch = (p: Partial<OccurrenceForm>) => setForm((f) => ({ ...f, ...p }));

  const submit = async () => {
    const checked = validateOccurrence(form, occurrence);
    setErrors(checked.errors);
    if (!checked.body) return;
    // Cancelling changes what people were promised, so it asks first.
    if (checked.body.status === 'cancelled' && !confirming) {
      setConfirming(true);
      return;
    }
    const res = await save.run({ params: { occurrenceId: occurrence.id }, body: checked.body });
    setConfirming(false);
    if (res) nav.back();
  };

  const kinds: { value: PortionChoice; label: string }[] = [
    { value: 'none', label: t('admin.occurrence.portion.none') },
    { value: 'para', label: t('admin.occurrence.portion.para') },
    { value: 'surah', label: t('admin.occurrence.portion.surah') },
    { value: 'ayah_range', label: t('admin.occurrence.portion.ayah_range') },
    { value: 'lesson', label: t('admin.occurrence.portion.lesson') },
  ];

  return (
    <View style={{ gap: spacing.lg }} testID="occurrence-form">
      <Card>
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <Text variant="body" strong heading={2}>
              {t('admin.occurrence.portion.title')}
            </Text>
            <Text variant="caption" color="textAccent" strong>
              {formatInstantDate(occurrence.startsAt, locale)}
            </Text>
          </View>
          <Select
            testID="occurrence-portion-kind"
            label={t('admin.occurrence.portion.kind')}
            value={form.portionKind}
            onChange={(portionKind) => patch({ portionKind })}
            options={kinds}
          />
          {form.portionKind === 'para' ? (
            <TextField
              testID="occurrence-para"
              label={t('admin.occurrence.para.label')}
              helper={t('admin.occurrence.para.help')}
              value={form.para}
              onChangeText={(para) => patch({ para })}
              error={shown.para ? t(shown.para) : undefined}
              keyboardType="number-pad"
              contentDirection="ltr"
              required
            />
          ) : null}
          {form.portionKind === 'surah' || form.portionKind === 'ayah_range' ? (
            <TextField
              testID="occurrence-surah"
              label={t('admin.occurrence.surah.label')}
              helper={t('admin.occurrence.surah.help')}
              value={form.surah}
              onChangeText={(surah) => patch({ surah })}
              error={shown.surah ? t(shown.surah) : undefined}
              keyboardType="number-pad"
              contentDirection="ltr"
              required
            />
          ) : null}
          {form.portionKind === 'ayah_range' ? (
            <View style={{ gap: spacing.md }}>
              <TextField
                testID="occurrence-from-ayah"
                label={t('admin.occurrence.fromAyah')}
                value={form.fromAyah}
                onChangeText={(fromAyah) => patch({ fromAyah })}
                keyboardType="number-pad"
                contentDirection="ltr"
                required
              />
              <TextField
                testID="occurrence-to-ayah"
                label={t('admin.occurrence.toAyah')}
                value={form.toAyah}
                onChangeText={(toAyah) => patch({ toAyah })}
                error={shown.ayahs ? t(shown.ayahs) : undefined}
                keyboardType="number-pad"
                contentDirection="ltr"
                required
              />
            </View>
          ) : null}
          {form.portionKind === 'lesson' ? (
            <TextField
              testID="occurrence-lesson"
              label={t('admin.occurrence.lesson.label')}
              value={form.lesson}
              onChangeText={(lesson) => patch({ lesson })}
              error={shown.lesson ? t(shown.lesson) : undefined}
              maxLength={200}
              required
            />
          ) : null}
          {form.portionKind !== 'none' ? (
            <TextField
              testID="occurrence-portion-label"
              label={t('admin.occurrence.portionLabel.label')}
              helper={t('admin.occurrence.portionLabel.help')}
              value={form.portionLabel}
              onChangeText={(portionLabel) => patch({ portionLabel })}
              error={shown.portionLabel ? t(shown.portionLabel) : undefined}
              maxLength={200}
            />
          ) : null}
          {/* Drawn in the artboard; set on the circle and the session, so read only here. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <TextField
                testID="occurrence-teacher"
                label={t('admin.occurrence.teacher')}
                value={teacher ?? '—'}
                onChangeText={() => undefined}
                disabled
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <TextField
                testID="occurrence-time"
                label={t('admin.occurrence.time')}
                value={formatInstantTime(occurrence.startsAt, locale)}
                onChangeText={() => undefined}
                disabled
              />
            </View>
          </View>
          {!past ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">{t('admin.occurrence.status')}</Text>
              <SegmentedControl
                testID="occurrence-status"
                accessibilityLabel={t('admin.occurrence.status')}
                value={form.cancelled ? 'cancelled' : 'scheduled'}
                onChange={(v) => patch({ cancelled: v === 'cancelled' })}
                options={[
                  { value: 'scheduled', label: t('admin.occurrence.scheduled') },
                  { value: 'cancelled', label: t('admin.home.cancelled') },
                ]}
              />
              {form.cancelled && occurrence.status !== 'cancelled' ? (
                <Switch
                  testID="occurrence-notify"
                  label={t('admin.occurrence.cancel.notify')}
                  description={t('admin.occurrence.cancel.help')}
                  value={form.notify}
                  onValueChange={(notify) => patch({ notify })}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="body" strong heading={2}>
            {t('admin.occurrence.recap.title')}
          </Text>
          <TextField
            testID="occurrence-recap"
            label={t('admin.occurrence.recap.label')}
            helper={t('admin.occurrence.recap.help')}
            value={form.recapNote}
            onChangeText={(recapNote) => patch({ recapNote })}
            error={shown.recap ? t(shown.recap) : undefined}
            multiline
            maxLength={2000}
            contentDirection={form.recapLocale === 'ur' ? 'rtl' : 'ltr'}
          />
          <SegmentedControl
            accessibilityLabel={t('admin.occurrence.recap.language')}
            value={form.recapLocale}
            onChange={(recapLocale) => patch({ recapLocale })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ur', label: 'اردو' },
            ]}
          />
        </View>
      </Card>

      {shown.nothing ? (
        <Text variant="caption" color="textDanger" testID="occurrence-nothing">
          {t(shown.nothing)}
        </Text>
      ) : null}
      <ErrorNotice error={confirming ? null : save.error} onDismiss={save.reset} />
      <ScreenFooter>
        <Button
          testID="occurrence-save"
          label={t('admin.occurrence.save')}
          trailingIcon="arrow-forward"
          size="large"
          fullWidth
          loading={save.status === 'running' && !confirming}
          onPress={() => void submit()}
        />
      </ScreenFooter>

      <ConfirmSheet
        testID="occurrence-cancel-confirm"
        visible={confirming}
        title={t('admin.occurrence.cancel.title')}
        message={
          form.notify
            ? t('admin.occurrence.cancel.confirmNotify')
            : t('admin.occurrence.cancel.confirmQuiet')
        }
        confirmLabel={t('admin.occurrence.cancel.confirm')}
        cancelLabel={t('admin.common.cancel')}
        destructive
        busy={save.status === 'running'}
        onCancel={() => {
          save.reset();
          setConfirming(false);
        }}
        onConfirm={() => void submit()}
      />
    </View>
  );
}
