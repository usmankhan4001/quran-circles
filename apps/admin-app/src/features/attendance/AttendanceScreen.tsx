import { useReducer, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { AdminOccurrence, Attendance } from '@qc/contracts';
import { ApiClientError } from '@qc/contracts';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Text,
  TextField,
  Toast,
  isolate,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import { useMutation, useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import type { MessageKey } from '../../i18n/translate';
import { useApi } from '../../auth/AuthProvider';
import { ErrorNotice } from '../../components/ErrorNotice';
import { NotAvailable } from '../../components/NotAvailable';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen, ScreenFooter } from '../../components/Screen';
import { formatInstantDate, formatInstantTime, isToday } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { sessionNotAvailable, useSession } from '../home/useSession';
import { useRegistrants } from '../registrants/useRegistrants';
import {
  attendanceReducer,
  entriesTotal,
  initialAttendanceState,
  MAX_HEADCOUNT,
  validateAttendance,
} from './state';

export interface AttendanceScreenProps {
  sessionId: string;
  occurrenceId: string;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The end-of-session tick list: a headcount first, then optionally who came. Quick to use with
 * one thumb. Attendance is for the coordinator only: nothing here is shown to attendees.
 */
export function AttendanceScreen({
  sessionId,
  occurrenceId,
  now = new Date(),
}: AttendanceScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const session = useSession(sessionId);

  const occurrence = useQuery<AdminOccurrence>(async () => {
    const res = await api.adminSessions.occurrences({
      params: { sessionId },
      query: { from: new Date(now.getTime() - 60 * DAY_MS).toISOString(), limit: 100 },
    });
    const found = res.items.find((o) => o.id === occurrenceId);
    if (!found) throw new ApiClientError(404, 'not_found', null);
    return found;
  }, [sessionId, occurrenceId]);

  const allowed = session.data ? sessionAbilities(principal, session.data).markAttendance : true;

  const live = occurrence.data ? isToday(occurrence.data.startsAt, now) : false;
  return (
    <Screen
      title={live ? t('admin.attendance.tonightTitle') : t('admin.attendance.title')}
      actions={
        live ? (
          <Text testID="attendance-live" variant="caption" color="textAccent" strong>
            {t('admin.attendance.live')}
          </Text>
        ) : undefined
      }
      subtitle={
        occurrence.data
          ? `${formatInstantDate(occurrence.data.startsAt, locale)} · ${formatInstantTime(occurrence.data.startsAt, locale)}`
          : undefined
      }
      onBack={nav.back}
      testID="attendance"
    >
      {sessionNotAvailable(session) ? (
        <NotAvailable testID="attendance-not-available" />
      ) : !allowed ? (
        <Card variant="flat" testID="attendance-forbidden">
          <Text>{t('errors.forbidden')}</Text>
        </Card>
      ) : (
        <QueryBoundary query={occurrence} testID="attendance-occurrence" notFoundIsNotAvailable>
          {() => <AttendanceFlow sessionId={sessionId} occurrenceId={occurrenceId} />}
        </QueryBoundary>
      )}
    </Screen>
  );
}

function AttendanceFlow({ sessionId, occurrenceId }: { sessionId: string; occurrenceId: string }) {
  const api = useApi();
  const attendance = useQuery(
    () => api.adminAttendance.get({ params: { occurrenceId } }),
    [occurrenceId],
  );
  return (
    <QueryBoundary query={attendance} testID="attendance-data">
      {(initial) => (
        <AttendanceForm sessionId={sessionId} occurrenceId={occurrenceId} initial={initial} />
      )}
    </QueryBoundary>
  );
}

/** Starts from what was saved, so nothing loaded later can overwrite what the person is typing. */
function AttendanceForm({
  sessionId,
  occurrenceId,
  initial,
}: {
  sessionId: string;
  occurrenceId: string;
  initial: Attendance;
}) {
  const { t, n } = useT();
  const { colors } = useTheme();
  const api = useApi();
  const [state, dispatch] = useReducer(attendanceReducer, initial, (saved) =>
    attendanceReducer(initialAttendanceState, { type: 'load', attendance: saved }),
  );
  const [error, setError] = useState<MessageKey | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const registrants = useRegistrants({ sessionId, occurrenceId, status: 'confirmed', pollMs: 0 });
  const save = useMutation(api.adminAttendance.put);

  const submit = async () => {
    const checked = validateAttendance(state);
    if (!checked.body) {
      setError(checked.error ?? 'errors.validation_failed');
      return;
    }
    setError(null);
    const saved = await save.run({ params: { occurrenceId }, body: checked.body });
    if (saved) {
      dispatch({ type: 'saved' });
      setSavedAt(saved.markedAt ?? 'saved');
    }
  };

  const total = entriesTotal(state);

  const tickedPeople = registrants.items.filter((r) => r.id in state.ticked).length;

  return (
    <View style={{ gap: spacing.lg }} testID="attendance-form">
      <Card testID="attendance-headcount-card">
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
            <Text variant="label" strong heading={2}>
              {t('admin.attendance.presentCount', { count: n(state.headcount) })}
            </Text>
            <Text variant="caption" color="textSecondary">
              {t('admin.attendance.includesDropIns')}
            </Text>
          </View>
          <View
            testID="attendance-headcount"
            role="group"
            aria-label={t('admin.attendance.headcount.label')}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, flexGrow: 1 }}
            >
              <Text testID="attendance-headcount-value" variant="display" lang="en">
                {n(state.headcount)}
              </Text>
              <Text variant="caption" color="textSecondary">
                {t('admin.attendance.inHall')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <CountButton
                testID="attendance-headcount-decrease"
                label="−1"
                accessibilityLabel={t('admin.common.decrease', {
                  label: t('admin.attendance.headcount.label'),
                })}
                disabled={state.headcount <= 0}
                onPress={() => {
                  setTyped(null);
                  dispatch({ type: 'setHeadcount', value: Math.max(0, state.headcount - 1) });
                }}
              />
              <CountButton
                testID="attendance-headcount-increase"
                label="+1"
                tone="emerald"
                accessibilityLabel={t('admin.common.increase', {
                  label: t('admin.attendance.headcount.label'),
                })}
                disabled={state.headcount >= MAX_HEADCOUNT}
                onPress={() => {
                  setTyped(null);
                  dispatch({
                    type: 'setHeadcount',
                    value: Math.min(MAX_HEADCOUNT, state.headcount + 1),
                  });
                }}
              />
              <CountButton
                testID="attendance-headcount-plus-five"
                label={t('admin.attendance.walkIn')}
                tone="tint"
                wide
                accessibilityLabel={t('admin.attendance.plusFive')}
                disabled={state.headcount >= MAX_HEADCOUNT}
                onPress={() => {
                  setTyped(null);
                  dispatch({
                    type: 'setHeadcount',
                    value: Math.min(MAX_HEADCOUNT, state.headcount + 5),
                  });
                }}
              />
            </View>
          </View>
        </View>
      </Card>

      <View testID="attendance-tick-list" style={{ gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          <Text variant="title3" heading={2}>
            {t('admin.attendance.registeredTitle')}
          </Text>
          {registrants.items.length > 0 ? (
            <Text variant="caption" color="textAccent" strong testID="attendance-ticked-count">
              {t('admin.attendance.ticked', {
                present: n(tickedPeople),
                total: n(registrants.items.length),
              })}
            </Text>
          ) : null}
        </View>
        <QueryBoundary query={registrants.query} testID="attendance-registrants">
          {() =>
            registrants.items.length === 0 ? (
              <EmptyState
                title={t('admin.attendance.noRegistrantsTitle')}
                description={t('admin.attendance.noRegistrantsBody')}
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {registrants.items.map((r) => (
                  <CheckInRow
                    key={r.id}
                    testID={`attendance-tick-${r.id}`}
                    name={r.name ? isolate(r.name) : t('admin.registrants.noName')}
                    sub={t(`admin.registrants.section.${r.section}`)}
                    checked={r.id in state.ticked}
                    onToggle={(on) =>
                      dispatch(
                        on
                          ? { type: 'tick', registrationId: r.id, count: 1 }
                          : { type: 'untick', registrationId: r.id },
                      )
                    }
                  />
                ))}
                {registrants.hasMore ? (
                  <Button
                    testID="attendance-more"
                    label={t('admin.registrants.more')}
                    variant="outline"
                    fullWidth
                    loading={registrants.loadingMore}
                    onPress={() => void registrants.loadMore()}
                  />
                ) : null}
              </View>
            )
          }
        </QueryBoundary>
        {registrants.items.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button
              testID="attendance-tick-all"
              label={t('admin.attendance.markAll')}
              variant="secondary"
              icon="check"
              onPress={() =>
                dispatch({
                  type: 'tickAll',
                  people: registrants.items.map((r) => ({
                    registrationId: r.id,
                    count: 1,
                  })),
                })
              }
            />
            {tickedPeople > 0 ? (
              <Button
                testID="attendance-clear"
                label={t('admin.attendance.clear')}
                variant="tertiary"
                onPress={() => dispatch({ type: 'clearTicks' })}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <Card testID="attendance-type-card">
        <View style={{ gap: spacing.sm }}>
          <TextField
            testID="attendance-headcount-input"
            label={t('admin.attendance.typeNumber')}
            value={typed ?? String(state.headcount)}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, '').slice(0, 4);
              setTyped(digits);
              dispatch({ type: 'setHeadcount', value: digits === '' ? 0 : Number(digits) });
            }}
            onBlur={() => setTyped(null)}
            keyboardType="number-pad"
            contentDirection="ltr"
          />
          {total > 0 ? (
            <Text variant="caption" color="textSecondary">
              {t('admin.attendance.tickedTotal', { count: n(total) })}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="title3" heading={2}>
              {t('admin.attendance.dropInsTitle')}
            </Text>
            <Text variant="caption" color="textSecondary">
              {t('admin.attendance.dropInsHelper')}
            </Text>
          </View>
          {state.dropIns.map((d, i) => (
            <View
              key={d.id}
              testID={`attendance-dropin-${d.id}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.xs,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text variant="label">
                  {d.name ? isolate(d.name) : t('admin.attendance.unnamed')}
                </Text>
              </View>
              <Button
                testID={`attendance-dropin-${d.id}-remove`}
                label={t('admin.attendance.remove')}
                variant="tertiary"
                onPress={() => dispatch({ type: 'removeDropIn', id: d.id })}
              />
            </View>
          ))}
          <TextField
            testID="attendance-new-name"
            label={t('admin.attendance.nameLabel')}
            value={newName}
            onChangeText={setNewName}
            maxLength={80}
          />
          <Button
            testID="attendance-add"
            label={t('admin.attendance.add')}
            variant="secondary"
            icon="plus"
            fullWidth
            onPress={() => {
              dispatch({ type: 'addDropIn', name: newName || null, count: 1 });
              setNewName('');
            }}
          />
        </View>
      </Card>

      {error ? (
        <Text variant="caption" color="textDanger" testID="attendance-error">
          {t(error)}
        </Text>
      ) : null}
      <ErrorNotice error={save.error} onDismiss={save.reset} />
      {savedAt && !state.dirty ? (
        <Toast
          testID="attendance-saved"
          kind="success"
          durationMs={0}
          message={t('admin.attendance.saved')}
        />
      ) : null}
      <ScreenFooter>
        <Button
          testID="attendance-save"
          label={t('admin.attendance.saveCount', { count: n(state.headcount) })}
          icon="check-circle"
          size="large"
          fullWidth
          loading={save.status === 'running'}
          onPress={() => void submit()}
        />
      </ScreenFooter>
    </View>
  );
}

/** −1, +1 and +5 by the headcount, as drawn: white, emerald and emerald tint rounds. */
function CountButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  tone = 'plain',
  wide,
  testID,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'plain' | 'emerald' | 'tint';
  wide?: boolean;
  testID?: string;
}) {
  const { colors, mode } = useTheme();
  const bg = disabled
    ? colors.disabledBackground
    : tone === 'emerald'
      ? colors.accent
      : tone === 'tint'
        ? colors.accentSubtle
        : colors.surface;
  const fg = disabled
    ? 'disabledText'
    : tone === 'emerald'
      ? 'textOnAccent'
      : tone === 'tint'
        ? 'textOnAccentSubtle'
        : 'text';
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={accessibilityLabel}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: minTouchTarget,
        height: minTouchTarget,
        paddingHorizontal: wide ? spacing.md : 0,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor:
          tone === 'plain' ? (mode === 'highContrast' ? colors.borderStrong : colors.border) : bg,
        backgroundColor: pressed && !disabled ? colors.surfaceMuted : bg,
        opacity: pressed && !disabled ? 0.85 : 1,
      })}
    >
      <Text variant="label" strong color={fg} lang="en" decorative>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * One registered person on the check-in list, as drawn: a white card with an icon tile, the name
 * and party, and a "Check in" pill that turns into "Checked in" in emerald tint. The whole row is
 * one checkbox for a screen reader.
 */
function CheckInRow({
  name,
  sub,
  checked,
  onToggle,
  testID,
}: {
  name: string;
  sub: string;
  checked: boolean;
  onToggle: (on: boolean) => void;
  testID?: string;
}) {
  const { t } = useT();
  const { colors, mode } = useTheme();
  return (
    <Pressable
      testID={testID}
      role="checkbox"
      aria-checked={checked}
      accessibilityLabel={`${name}, ${sub}`}
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: minTouchTarget + spacing.lg,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: mode === 'highContrast' ? colors.borderStrong : colors.hairline,
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
      })}
    >
      <View
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? colors.accentSubtle : colors.surfaceMuted,
        }}
      >
        <Icon
          name={checked ? 'check-circle' : 'ticket'}
          weight={checked ? 'fill' : 'duotone'}
          size={20}
          color={checked ? colors.textOnAccentSubtle : colors.textSecondary}
        />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="label" strong decorative>
          {name}
        </Text>
        <Text variant="caption" color="textSecondary" decorative>
          {sub}
        </Text>
      </View>
      <View
        aria-hidden
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xxs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: checked
            ? colors.accent
            : mode === 'highContrast'
              ? colors.borderStrong
              : colors.border,
          backgroundColor: checked ? colors.accentSubtle : colors.surface,
        }}
      >
        {checked ? <Icon name="check" size={14} color={colors.textOnAccentSubtle} /> : null}
        <Text variant="caption" strong color={checked ? 'textOnAccentSubtle' : 'text'} decorative>
          {checked ? t('admin.attendance.checkedIn') : t('admin.attendance.checkIn')}
        </Text>
      </View>
    </Pressable>
  );
}
