import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { AdminOccurrence, AdminSession } from '@qc/contracts';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  Icon,
  Select,
  Switch,
  Text,
  TextField,
  spacing,
  useTheme,
} from '@qc/ui';
import { serverFieldErrors } from '../../api/errors';
import { useMutation, useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { ErrorNotice } from '../../components/ErrorNotice';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen, ScreenFooter } from '../../components/Screen';
import { Stepper } from '../../components/Stepper';
import { pickLocalized } from '../../lib/localized';
import {
  formatLocalDate,
  formatLocalTime,
  pkDateOf,
  pkDayRange,
  weekdayName,
} from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSession } from '../home/useSession';
import { whenSummary } from '../home/sessionText';
import {
  initialScheduleForm,
  MAX_DURATION,
  MIN_DURATION,
  tidyTime,
  validateSchedule,
  type ScheduleErrors,
  type ScheduleForm,
} from './form';

/** Where the server's validation paths land on this form. */
const SCHEDULE_FIELDS = {
  localStartTime: 'time',
  durationMinutes: 'duration',
  daysOfWeek: 'days',
  effectiveFrom: 'effectiveFrom',
} as const;

export interface ScheduleScreenProps {
  sessionId: string;
  now?: Date;
}

interface Loaded {
  session: AdminSession;
  occurrences: AdminOccurrence[];
  /** People registered, counting party sizes. Null when the person cannot see it. */
  people: number | null;
}

/** Change a session's time or days from a date, with the effect spelled out before saving. */
export function ScheduleScreen({ sessionId, now = new Date() }: ScheduleScreenProps) {
  const { t } = useT();
  const nav = useNavigation();
  const sessionQuery = useSession(sessionId);
  return (
    <Screen title={t('admin.schedule.title')} onBack={nav.back} testID="schedule">
      <QueryBoundary query={sessionQuery} testID="schedule-data" notFoundIsNotAvailable>
        {(session) => <ScheduleGate session={session} now={now} />}
      </QueryBoundary>
    </Screen>
  );
}

/** Checks the right before anything protected is requested, so a refusal never reaches the server. */
function ScheduleGate({ session, now }: { session: AdminSession; now: Date }) {
  const { t } = useT();
  const { principal } = useWorkingScope();
  if (!sessionAbilities(principal, session).changeSchedule) {
    return (
      <Card variant="flat" testID="schedule-forbidden">
        <Text>{t('errors.forbidden')}</Text>
      </Card>
    );
  }
  return <ScheduleLoader session={session} now={now} />;
}

function ScheduleLoader({ session, now }: { session: AdminSession; now: Date }) {
  const api = useApi();
  const query = useQuery<Loaded>(async () => {
    const [occ, regs] = await Promise.all([
      api.adminSessions.occurrences({
        params: { sessionId: session.id },
        query: { from: pkDayRange(now).from, limit: 30 },
      }),
      // The count only informs the confirmation, so a failure here must not block the change.
      api.registrations
        .forSession({ params: { sessionId: session.id }, query: { status: 'confirmed', limit: 1 } })
        .catch(() => null),
    ]);
    return { session, occurrences: occ.items, people: regs?.totals.people ?? null };
  }, [session.id]);
  return (
    <QueryBoundary query={query} testID="schedule-details">
      {(loaded) => <ScheduleFlow loaded={loaded} now={now} />}
    </QueryBoundary>
  );
}

function ScheduleFlow({ loaded, now }: { loaded: Loaded; now: Date }) {
  const { t, locale, n } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { session, occurrences, people } = loaded;
  const { colors } = useTheme();

  const dates = useMemo(
    () => [
      ...new Set(
        occurrences.filter((o) => o.status !== 'cancelled').map((o) => pkDateOf(o.startsAt)),
      ),
    ],
    [occurrences],
  );
  const [form, setForm] = useState<ScheduleForm>(() =>
    initialScheduleForm(session, dates[0] ?? pkDateOf(now)),
  );
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [confirming, setConfirming] = useState(false);
  const change = useMutation(api.adminSessions.changeSchedule);
  // What the form found, else what the server rejected (`ApiClientError.issues`).
  const shown = { ...serverFieldErrors(change.error, SCHEDULE_FIELDS), ...errors };
  const patch = (p: Partial<ScheduleForm>) => setForm((f) => ({ ...f, ...p }));

  const checked = validateSchedule(form, session);
  const affected = occurrences.filter(
    (o) => o.status !== 'cancelled' && pkDateOf(o.startsAt) >= form.effectiveFrom,
  ).length;

  const review = () => {
    setErrors(checked.errors);
    if (checked.body) setConfirming(true);
  };

  const save = async () => {
    if (!checked.body) return;
    await change.run({ params: { sessionId: session.id }, body: checked.body });
    setConfirming(false);
  };

  if (change.status === 'success' && change.data) {
    const res = change.data;
    return (
      <View style={{ gap: spacing.lg }} testID="schedule-done">
        <Card variant="flat">
          <View style={{ gap: spacing.sm }}>
            <Text variant="title3" heading={2}>
              {t('admin.schedule.success')}
            </Text>
            <Text>{t.plural('admin.schedule.saved.dates', res.occurrencesChanged)}</Text>
            <Text variant="caption" color="textSecondary">
              {res.updatePostedId
                ? t('admin.schedule.saved.notified')
                : t('admin.schedule.saved.quiet')}
            </Text>
            <Text variant="caption" color="textSecondary">
              {t('admin.schedule.posterNote')}
            </Text>
          </View>
        </Card>
        <ScreenFooter>
          <Button label={t('admin.common.done')} size="large" fullWidth onPress={nav.back} />
        </ScreenFooter>
      </View>
    );
  }

  const peopleLine = form.notify
    ? people === null
      ? t('admin.schedule.effect.notifyUnknown')
      : t.plural('admin.schedule.effect.notify', people)
    : t('admin.schedule.effect.quiet');

  return (
    <View style={{ gap: spacing.lg }} testID="schedule-form">
      <Card variant="flat">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
            }}
          >
            <Icon name="clock" color={colors.accent} size={22} />
          </View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="caption" color="textSecondary">
              {pickLocalized(session.title, locale)}
            </Text>
            <Text variant="label" testID="schedule-current">
              {t('admin.schedule.current', { when: whenSummary(session, t, locale) })}
            </Text>
            <Text variant="caption" color="textSecondary">
              {n(session.durationMinutes)} {t('admin.schedule.minutes')}
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <TextField
            testID="schedule-time"
            label={t('admin.schedule.time.label')}
            helper={t('admin.schedule.time.help')}
            value={form.time}
            onChangeText={(time) => patch({ time })}
            onBlur={() => patch({ time: tidyTime(form.time) })}
            error={shown.time ? t(shown.time) : undefined}
            keyboardType="numbers-and-punctuation"
            contentDirection="ltr"
            maxLength={5}
            required
          />
          <Stepper
            testID="schedule-duration"
            label={t('admin.schedule.duration.label')}
            value={form.durationMinutes}
            min={MIN_DURATION}
            max={MAX_DURATION}
            step={5}
            onChange={(durationMinutes) => patch({ durationMinutes })}
          />
          {shown.duration ? (
            <Text variant="caption" color="textDanger">
              {t(shown.duration)}
            </Text>
          ) : null}
        </View>
      </Card>

      {session.kind === 'recurring' ? (
        <Card>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label">{t('admin.schedule.days.label')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <Chip
                  key={d}
                  testID={`schedule-day-${d}`}
                  label={weekdayName(d, locale, 'short')}
                  selected={form.days.includes(d)}
                  onPress={() =>
                    patch({
                      days: form.days.includes(d)
                        ? form.days.filter((x) => x !== d)
                        : [...form.days, d],
                    })
                  }
                />
              ))}
            </View>
            {shown.days ? (
              <Text variant="caption" color="textDanger">
                {t(shown.days)}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Select
        testID="schedule-from"
        label={t('admin.schedule.from.label')}
        helper={t('admin.schedule.from.help')}
        required
        value={form.effectiveFrom}
        onChange={(effectiveFrom) => patch({ effectiveFrom })}
        options={(dates.length > 0 ? dates : [form.effectiveFrom]).map((d) => ({
          value: d,
          label: formatLocalDate(d, locale),
        }))}
        error={shown.effectiveFrom ? t(shown.effectiveFrom) : undefined}
      />

      <Card>
        <View style={{ gap: spacing.xs }}>
          <Switch
            testID="schedule-notify"
            label={t('admin.schedule.notify.label')}
            description={t('admin.schedule.notify.help')}
            value={form.notify}
            onValueChange={(notify) => patch({ notify })}
          />
          <Text variant="caption" color="textSecondary" testID="schedule-effect-people">
            {peopleLine}
          </Text>
        </View>
      </Card>

      {shown.nothing ? (
        <Text variant="caption" color="textDanger" testID="schedule-nothing">
          {t(shown.nothing)}
        </Text>
      ) : null}
      <ErrorNotice error={confirming ? null : change.error} onDismiss={change.reset} />
      <ScreenFooter>
        <Button
          testID="schedule-review"
          label={t('admin.schedule.review')}
          size="large"
          fullWidth
          onPress={review}
        />
      </ScreenFooter>

      <ConfirmSheet
        testID="schedule-confirm"
        visible={confirming}
        title={t('admin.schedule.confirm.title')}
        message={[
          t('admin.schedule.effect.when', {
            time: formatLocalTime(tidyTime(form.time), locale),
            date: formatLocalDate(form.effectiveFrom, locale),
          }),
          t.plural('admin.schedule.effect.dates', affected),
          peopleLine,
          t('admin.schedule.posterNote'),
        ].join('\n')}
        confirmLabel={t('admin.schedule.submit')}
        cancelLabel={t('admin.common.cancel')}
        busy={change.status === 'running'}
        onCancel={() => {
          change.reset();
          setConfirming(false);
        }}
        onConfirm={() => void save()}
      />
    </View>
  );
}
