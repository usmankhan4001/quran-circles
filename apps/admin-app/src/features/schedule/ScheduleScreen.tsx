import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { AdminOccurrence, Session } from '@qc/contracts';
import { Button, Card, Chip, Select, Switch, Text, TextField, spacing } from '@qc/ui';
import { useMutation, useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { ErrorNotice } from '../../components/ErrorNotice';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { Stepper } from '../../components/Stepper';
import { pickLocalized } from '../../lib/localized';
import { formatLocalDate, formatLocalTime, pkDateOf, pkDayRange, weekdayName } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSession, useSessionDirectory } from '../home/sessionDirectory';
import {
  initialScheduleForm,
  MAX_DURATION,
  MIN_DURATION,
  tidyTime,
  validateSchedule,
  type ScheduleErrors,
  type ScheduleForm,
} from './form';

export interface ScheduleScreenProps {
  sessionId: string;
  now?: Date;
}

interface Loaded {
  session: Session;
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
      <QueryBoundary query={sessionQuery} testID="schedule">
        {(session) => <ScheduleLoader session={session} now={now} />}
      </QueryBoundary>
    </Screen>
  );
}

function ScheduleLoader({ session, now }: { session: Session; now: Date }) {
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
    <QueryBoundary query={query} testID="schedule-data">
      {(loaded) => <ScheduleFlow loaded={loaded} now={now} />}
    </QueryBoundary>
  );
}

function ScheduleFlow({ loaded, now }: { loaded: Loaded; now: Date }) {
  const { t, locale, n } = useT();
  const api = useApi();
  const nav = useNavigation();
  const dir = useSessionDirectory();
  const { principal } = useWorkingScope();
  const { session, occurrences, people } = loaded;

  const dates = useMemo(
    () => [...new Set(occurrences.filter((o) => o.status !== 'cancelled').map((o) => pkDateOf(o.startsAt)))],
    [occurrences],
  );
  const [form, setForm] = useState<ScheduleForm>(() =>
    initialScheduleForm(session, dates[0] ?? pkDateOf(now)),
  );
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [confirming, setConfirming] = useState(false);
  const change = useMutation(api.adminSessions.changeSchedule);
  const allowed = sessionAbilities(principal, session).changeSchedule;
  const patch = (p: Partial<ScheduleForm>) => setForm((f) => ({ ...f, ...p }));

  if (!allowed) {
    return (
      <Card variant="flat" testID="schedule-forbidden">
        <Text>{t('errors.forbidden')}</Text>
      </Card>
    );
  }

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
    const res = await change.run({ params: { sessionId: session.id }, body: checked.body });
    if (res) dir.remember([res.session]);
    setConfirming(false);
  };

  if (change.status === 'success' && change.data) {
    const res = change.data;
    return (
      <View style={{ gap: spacing.lg }} testID="schedule-done">
        <Card variant="flat">
          <View style={{ gap: spacing.sm }}>
            <Text variant="title3" heading={2}>
              {t('admin.schedule.savedTitle')}
            </Text>
            <Text>{t.plural('admin.schedule.savedDates', res.occurrencesChanged)}</Text>
            <Text variant="caption" color="textSecondary">
              {res.updatePostedId
                ? t('admin.schedule.savedNotified')
                : t('admin.schedule.savedQuiet')}
            </Text>
            <Text variant="caption" color="textSecondary">
              {t('admin.schedule.posterNote')}
            </Text>
          </View>
        </Card>
        <Button label={t('admin.common.done')} size="large" fullWidth onPress={nav.back} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }} testID="schedule-form">
      <Card variant="flat">
        <Text variant="caption" color="textSecondary">
          {pickLocalized(session.title, locale)}
        </Text>
        <Text variant="label">
          {formatLocalTime(session.localStartTime, locale)} · {n(session.durationMinutes)}{' '}
          {t('admin.schedule.minutesShort')}
        </Text>
      </Card>

      <TextField
        testID="schedule-time"
        label={t('admin.schedule.timeLabel')}
        helper={t('admin.schedule.timeHelper')}
        value={form.time}
        onChangeText={(time) => patch({ time })}
        onBlur={() => patch({ time: tidyTime(form.time) })}
        error={errors.time ? t(errors.time) : undefined}
        keyboardType="numbers-and-punctuation"
        contentDirection="ltr"
        maxLength={5}
        required
      />
      <Stepper
        testID="schedule-duration"
        label={t('admin.schedule.durationLabel')}
        value={form.durationMinutes}
        min={MIN_DURATION}
        max={MAX_DURATION}
        step={5}
        onChange={(durationMinutes) => patch({ durationMinutes })}
      />
      {errors.duration ? (
        <Text variant="caption" color="textDanger">
          {t(errors.duration)}
        </Text>
      ) : null}

      {session.kind === 'recurring' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="label">{t('admin.schedule.daysLabel')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <Chip
                key={d}
                testID={`schedule-day-${d}`}
                label={weekdayName(d, locale, 'short')}
                selected={form.days.includes(d)}
                onPress={() =>
                  patch({
                    days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d],
                  })
                }
              />
            ))}
          </View>
          {errors.days ? (
            <Text variant="caption" color="textDanger">
              {t(errors.days)}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Select
        testID="schedule-from"
        label={t('admin.schedule.fromLabel')}
        helper={t('admin.schedule.fromHelper')}
        required
        value={form.effectiveFrom}
        onChange={(effectiveFrom) => patch({ effectiveFrom })}
        options={(dates.length > 0 ? dates : [form.effectiveFrom]).map((d) => ({
          value: d,
          label: formatLocalDate(d, locale),
        }))}
        error={errors.effectiveFrom ? t(errors.effectiveFrom) : undefined}
      />

      <Switch
        testID="schedule-notify"
        label={t('admin.schedule.notify')}
        description={t('admin.schedule.notifyHelper')}
        value={form.notify}
        onValueChange={(notify) => patch({ notify })}
      />

      {errors.nothing ? (
        <Text variant="caption" color="textDanger" testID="schedule-nothing">
          {t(errors.nothing)}
        </Text>
      ) : null}
      <Button
        testID="schedule-review"
        label={t('admin.schedule.review')}
        size="large"
        fullWidth
        onPress={review}
      />

      <ConfirmSheet
        testID="schedule-confirm"
        visible={confirming}
        title={t('admin.schedule.confirmTitle')}
        confirmLabel={t('admin.schedule.save')}
        busy={change.status === 'running'}
        onCancel={() => {
          change.reset();
          setConfirming(false);
        }}
        onConfirm={() => void save()}
      >
        <View style={{ gap: spacing.sm }}>
          <Text>
            {t('admin.schedule.effect.when', {
              time: formatLocalTime(tidyTime(form.time), locale),
              date: formatLocalDate(form.effectiveFrom, locale),
            })}
          </Text>
          <Text>{t.plural('admin.schedule.effect.dates', affected)}</Text>
          <Text testID="schedule-effect-people">
            {form.notify
              ? people === null
                ? t('admin.schedule.effect.notifyUnknown')
                : t.plural('admin.schedule.effect.notify', people)
              : t('admin.schedule.effect.quiet')}
          </Text>
          <Text>{t('admin.schedule.posterNote')}</Text>
        </View>
        <ErrorNotice error={change.error} onDismiss={change.reset} />
      </ConfirmSheet>
    </View>
  );
}
