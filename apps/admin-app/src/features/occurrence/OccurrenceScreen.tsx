import { useState } from 'react';
import { View } from 'react-native';
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
  spacing,
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
import { formatInstantDate, formatInstantTime } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
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

  const query = useQuery<AdminOccurrence>(async () => {
    const res = await api.adminSessions.occurrences({
      params: { sessionId },
      query: { from: new Date(now.getTime() - 60 * DAY_MS).toISOString(), limit: 100 },
    });
    const found = res.items.find((o) => o.id === occurrenceId);
    if (!found) throw new ApiClientError(404, 'not_found', null);
    return found;
  }, [sessionId, occurrenceId]);

  const allowed = session.data ? sessionAbilities(principal, session.data).editOccurrence : true;

  return (
    <Screen title={t('admin.occurrence.title')} onBack={nav.back} testID="occurrence">
      {sessionNotAvailable(session) ? (
        <NotAvailable testID="occurrence-not-available" />
      ) : !allowed ? (
        <Card variant="flat" testID="occurrence-forbidden">
          <Text>{t('errors.forbidden')}</Text>
        </Card>
      ) : (
        <QueryBoundary query={query} testID="occurrence-data" notFoundIsNotAvailable>
          {(occurrence) => <OccurrenceFlow occurrence={occurrence} now={now} />}
        </QueryBoundary>
      )}
    </Screen>
  );
}

function OccurrenceFlow({ occurrence, now }: { occurrence: AdminOccurrence; now: Date }) {
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
      <Card variant="flat">
        <View style={{ gap: spacing.xs }}>
          <Text variant="label">
            {formatInstantDate(occurrence.startsAt, locale)} ·{' '}
            {formatInstantTime(occurrence.startsAt, locale)}
          </Text>
          {occurrence.status === 'cancelled' ? (
            <Tag label={t('admin.home.cancelled')} kind="alert" />
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="title3" heading={2}>
            {t('admin.occurrence.portion.title')}
          </Text>
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
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="title3" heading={2}>
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

      {!past ? (
        <Card variant="outlined">
          <View style={{ gap: spacing.sm }}>
            <Switch
              testID="occurrence-cancelled"
              label={t('admin.occurrence.cancel.this')}
              description={t('admin.occurrence.cancel.help')}
              value={form.cancelled}
              onValueChange={(cancelled) => patch({ cancelled })}
            />
            {form.cancelled && occurrence.status !== 'cancelled' ? (
              <Switch
                testID="occurrence-notify"
                label={t('admin.occurrence.cancel.notify')}
                value={form.notify}
                onValueChange={(notify) => patch({ notify })}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {shown.nothing ? (
        <Text variant="caption" color="textDanger" testID="occurrence-nothing">
          {t(shown.nothing)}
        </Text>
      ) : null}
      <ErrorNotice error={confirming ? null : save.error} onDismiss={save.reset} />
      <ScreenFooter>
        <Button
          testID="occurrence-save"
          label={t('admin.common.save')}
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
