import { useEffect, useReducer, useState } from 'react';
import { View } from 'react-native';
import type { AdminOccurrence } from '@qc/contracts';
import { ApiClientError } from '@qc/contracts';
import { Button, Card, EmptyState, Switch, Text, TextField, Toast, isolate, spacing } from '@qc/ui';
import { useMutation, useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import type { MessageKey } from '../../i18n/translate';
import { useApi } from '../../auth/AuthProvider';
import { ErrorNotice } from '../../components/ErrorNotice';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen } from '../../components/Screen';
import { Stepper } from '../../components/Stepper';
import { formatInstantDate, formatInstantTime } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { useSession } from '../home/sessionDirectory';
import { useRegistrants } from '../registrants/useRegistrants';
import {
  attendanceReducer,
  entriesTotal,
  initialAttendanceState,
  MAX_ENTRY_COUNT,
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
export function AttendanceScreen({ sessionId, occurrenceId, now = new Date() }: AttendanceScreenProps) {
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

  return (
    <Screen
      title={t('admin.attendance.title')}
      subtitle={
        occurrence.data
          ? `${formatInstantDate(occurrence.data.startsAt, locale)} · ${formatInstantTime(occurrence.data.startsAt, locale)}`
          : undefined
      }
      onBack={nav.back}
      testID="attendance"
    >
      {!allowed ? (
        <Card variant="flat" testID="attendance-forbidden">
          <Text>{t('errors.forbidden')}</Text>
        </Card>
      ) : (
        <QueryBoundary query={occurrence} testID="attendance-occurrence">
          {() => <AttendanceFlow sessionId={sessionId} occurrenceId={occurrenceId} />}
        </QueryBoundary>
      )}
    </Screen>
  );
}

function AttendanceFlow({ sessionId, occurrenceId }: { sessionId: string; occurrenceId: string }) {
  const { t, n } = useT();
  const api = useApi();
  const [state, dispatch] = useReducer(attendanceReducer, initialAttendanceState);
  const [error, setError] = useState<MessageKey | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCount, setNewCount] = useState(1);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const attendance = useQuery(
    () => api.adminAttendance.get({ params: { occurrenceId } }),
    [occurrenceId],
  );
  const registrants = useRegistrants({ sessionId, occurrenceId, status: 'confirmed', pollMs: 0 });
  const save = useMutation(api.adminAttendance.put);

  useEffect(() => {
    if (attendance.data) dispatch({ type: 'load', attendance: attendance.data });
  }, [attendance.data]);

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

  return (
    <QueryBoundary query={attendance} testID="attendance-data">
      {() => (
        <View style={{ gap: spacing.lg }} testID="attendance-form">
          <Card>
            <View style={{ gap: spacing.md }}>
              <Stepper
                testID="attendance-headcount"
                large
                label={t('admin.attendance.headcount')}
                value={state.headcount}
                min={0}
                max={MAX_HEADCOUNT}
                onChange={(value) => {
                  setTyped(null);
                  dispatch({ type: 'setHeadcount', value });
                }}
              />
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

          <Text variant="title3" heading={2}>
            {t('admin.attendance.registeredTitle')}
          </Text>
          <Text variant="caption" color="textSecondary">
            {t('admin.attendance.registeredHelper')}
          </Text>
          <QueryBoundary query={registrants.query} testID="attendance-registrants">
            {() =>
              registrants.items.length === 0 ? (
                <EmptyState
                  title={t('admin.attendance.noRegistrantsTitle')}
                  description={t('admin.attendance.noRegistrantsBody')}
                />
              ) : (
                <View>
                  {registrants.items.map((r) => (
                    <Switch
                      key={r.id}
                      testID={`attendance-tick-${r.id}`}
                      label={r.name ? isolate(r.name) : t('admin.registrants.noName')}
                      description={t.plural('admin.registrants.party', r.partySize)}
                      value={r.id in state.ticked}
                      onValueChange={(on) =>
                        dispatch(
                          on
                            ? { type: 'tick', registrationId: r.id, count: r.partySize }
                            : { type: 'untick', registrationId: r.id },
                        )
                      }
                    />
                  ))}
                  {registrants.hasMore ? (
                    <Button
                      testID="attendance-more"
                      label={t('admin.registrants.more')}
                      variant="secondary"
                      fullWidth
                      loading={registrants.loadingMore}
                      onPress={() => void registrants.loadMore()}
                    />
                  ) : null}
                </View>
              )
            }
          </QueryBoundary>

          <Text variant="title3" heading={2}>
            {t('admin.attendance.dropInsTitle')}
          </Text>
          <Text variant="caption" color="textSecondary">
            {t('admin.attendance.dropInsHelper')}
          </Text>
          {state.dropIns.map((d) => (
            <Card key={d.id} variant="outlined" testID={`attendance-dropin-${d.id}`}>
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">{d.name ? isolate(d.name) : t('admin.attendance.unnamed')}</Text>
                <Text variant="caption" color="textSecondary">
                  {t.plural('admin.registrants.party', d.count)}
                </Text>
                <Button
                  testID={`attendance-dropin-${d.id}-remove`}
                  label={t('admin.attendance.remove')}
                  variant="tertiary"
                  onPress={() => dispatch({ type: 'removeDropIn', id: d.id })}
                />
              </View>
            </Card>
          ))}
          <View style={{ gap: spacing.md }}>
            <TextField
              testID="attendance-new-name"
              label={t('admin.attendance.nameLabel')}
              value={newName}
              onChangeText={setNewName}
              maxLength={80}
            />
            <Stepper
              testID="attendance-new-count"
              label={t('admin.attendance.peopleLabel')}
              value={newCount}
              min={1}
              max={MAX_ENTRY_COUNT}
              onChange={setNewCount}
            />
            <Button
              testID="attendance-add"
              label={t('admin.attendance.add')}
              variant="secondary"
              fullWidth
              onPress={() => {
                dispatch({ type: 'addDropIn', name: newName || null, count: newCount });
                setNewName('');
                setNewCount(1);
              }}
            />
          </View>

          {error ? (
            <Text variant="caption" color="textDanger" testID="attendance-error">
              {t(error)}
            </Text>
          ) : null}
          <ErrorNotice error={save.error} onDismiss={save.reset} />
          {savedAt && !state.dirty ? (
            <Toast testID="attendance-saved" kind="success" durationMs={0} message={t('admin.attendance.saved')} />
          ) : null}
          <Button
            testID="attendance-save"
            label={t('admin.common.save')}
            size="large"
            fullWidth
            loading={save.status === 'running'}
            onPress={() => void submit()}
          />
        </View>
      )}
    </QueryBoundary>
  );
}
