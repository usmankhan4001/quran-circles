import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { AyahOfTheDay, DailyAyahEntry } from '@qc/contracts';
import {
  Button,
  Card,
  ConfirmSheet,
  DateStrip,
  Icon,
  StarNumber,
  Tag,
  Text,
  TextField,
  Toast,
  formatNumber,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import { serverFieldErrors } from '../../api/errors';
import { loadFeatureFlag } from '../../api/featureFlags';
import { useMutation, useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { ErrorNotice } from '../../components/ErrorNotice';
import { NotAvailable } from '../../components/NotAvailable';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen, ScreenFooter } from '../../components/Screen';
import { pickLocalized } from '../../lib/localized';
import { dayParts, formatLocalDate } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { loadVenue } from '../venues/loadVenue';
import {
  ayahCountOf,
  ayahFormOf,
  canPickFor,
  datesIn,
  fallbackOn,
  pickOn,
  pickWindow,
  placeQuery,
  typedSurah,
  validatePick,
  type AyahErrors,
  type AyahForm,
  type AyahPlace,
} from './pick';

export interface DailyAyahScreenProps {
  /** One of the two: the venue or the circle to pick for. */
  venueId?: string;
  circleId?: string;
  now?: Date;
}

/** Where the server's validation paths land on this form. */
const PICK_FIELDS = { surah: 'surah', ayah: 'ayah' } as const;

interface Loaded {
  place: AyahPlace;
  /** The `ayah_of_the_day` flag for the place's city. */
  on: boolean;
}

/**
 * A coordinator's ayah of the day for a venue or a circle they manage: see, set and remove the
 * pick for each of the coming days, and what followers see when there is none. Hidden when the
 * feature flag is off or the person's roles do not reach the place; the server checks again.
 */
export function DailyAyahScreen({ venueId, circleId, now = new Date() }: DailyAyahScreenProps) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();

  const query = useQuery<Loaded | null>(async () => {
    let place: AyahPlace;
    if (circleId) {
      const c = await api.adminCircles.get({ params: { circleId } });
      place = {
        type: 'circle',
        circleId: c.id,
        venueId: c.venueId,
        cityId: c.cityId,
        name: c.name,
      };
    } else if (venueId) {
      const v = await loadVenue(api, venueId);
      place = { type: 'venue', venueId: v.id, cityId: v.cityId, name: v.name };
    } else {
      return null;
    }
    return { place, on: await loadFeatureFlag(api, 'ayah_of_the_day', place.cityId) };
  }, [venueId, circleId]);

  const placeName =
    query.data && query.data.on ? pickLocalized(query.data.place.name, locale) : undefined;

  return (
    <Screen
      title={t('admin.dailyAyah.title')}
      subtitle={placeName}
      onBack={nav.back}
      testID="daily-ayah"
    >
      <QueryBoundary query={query} testID="daily-ayah-data" notFoundIsNotAvailable>
        {(loaded) =>
          !loaded || !loaded.on ? (
            // Flag off (or no place named): the feature does not exist for this person yet.
            <NotAvailable testID="daily-ayah-off" />
          ) : !canPickFor(principal, loaded.place) ? (
            <Card variant="flat" testID="daily-ayah-forbidden">
              <Text>{t('errors.forbidden')}</Text>
            </Card>
          ) : (
            <AyahPicker place={loaded.place} now={now} />
          )
        }
      </QueryBoundary>
    </Screen>
  );
}

interface Picks {
  national: DailyAyahEntry[];
  own: DailyAyahEntry[];
}

function AyahPicker({ place, now }: { place: AyahPlace; now: Date }) {
  const { t, locale } = useT();
  const api = useApi();
  const today = pickWindow(now).from;
  // Fixed for the day the screen opened on, so a re-render never moves the days.
  const range = useMemo(() => pickWindow(now), [today]);
  const [date, setDate] = useState(range.from);
  const [notice, setNotice] = useState<string | null>(null);
  const placeKey = place.type === 'venue' ? place.venueId : place.circleId;

  const picks = useQuery<Picks>(async () => {
    // National picks are listed to every coordinator (read only); they decide the fallback.
    const [national, own] = await Promise.all([
      api.adminDailyAyahs.list({ query: { ...range, scopeType: 'national' } }),
      api.adminDailyAyahs.list({ query: { ...range, ...placeQuery(place) } }),
    ]);
    return { national: national.items, own: own.items };
  }, [range.from, range.to, place.type, placeKey]);

  const days = datesIn(range).map((d) => {
    const parts = dayParts(d, locale);
    return {
      key: d,
      weekday: d === today ? t('admin.dailyAyah.today') : parts.weekday,
      day: formatNumber(parts.day, locale),
      accessibilityLabel: parts.full,
    };
  });

  return (
    <QueryBoundary query={picks} testID="daily-ayah-picks">
      {(data) => (
        <View style={{ gap: spacing.lg }}>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Text variant="title3" heading={2}>
                {t('admin.dailyAyah.day')}
              </Text>
              <DateStrip
                testID="daily-ayah-day"
                days={days}
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setNotice(null);
                }}
                accessibilityLabel={t('admin.dailyAyah.day')}
              />
            </View>
          </Card>
          {notice ? (
            <Toast
              testID="daily-ayah-notice"
              kind="success"
              durationMs={0}
              message={notice}
              onDismiss={() => setNotice(null)}
              dismissLabel={t('ui.dismiss')}
            />
          ) : null}
          <DayPanel
            key={date}
            date={date}
            place={place}
            pick={pickOn(date, data.own, place)}
            fallback={fallbackOn(date, data.national)}
            onSaved={async (message) => {
              setNotice(message);
              await picks.refetch();
            }}
            onRefresh={() => picks.refetch()}
          />
          <Upcoming
            picks={data.own.filter((p) => pickOn(p.date, [p], place))}
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setNotice(null);
            }}
          />
        </View>
      )}
    </QueryBoundary>
  );
}

/** "Surah 13, ayah 28", with the language's numerals. */
function useReference(): (a: Pick<AyahOfTheDay, 'surah' | 'ayah'>) => string {
  const { t, locale } = useT();
  return (a) =>
    t('admin.dailyAyah.reference', {
      surah: formatNumber(a.surah, locale),
      ayah: formatNumber(a.ayah, locale),
    });
}

function DayPanel({
  date,
  place,
  pick,
  fallback,
  onSaved,
  onRefresh,
}: {
  date: string;
  place: AyahPlace;
  pick: DailyAyahEntry | undefined;
  fallback: AyahOfTheDay;
  onSaved: (message: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const api = useApi();
  const reference = useReference();
  const [form, setForm] = useState<AyahForm>(() => ayahFormOf(pick));
  const [errors, setErrors] = useState<AyahErrors>({});
  const [removing, setRemoving] = useState(false);
  const save = useMutation(api.adminDailyAyahs.put);
  // `delete` answers 204 with no body, so success is marked explicitly.
  const remove = useMutation(async (dailyAyahId: string) => {
    await api.adminDailyAyahs.delete({ params: { dailyAyahId } });
    return true as const;
  });
  const dateLabel = formatLocalDate(date, locale);
  const patch = (p: Partial<AyahForm>) => setForm((f) => ({ ...f, ...p }));

  const surah = typedSurah(form);
  const count = surah === null ? null : ayahCountOf(surah);
  const server = serverFieldErrors(save.error, PICK_FIELDS);
  const surahError = errors.surah
    ? t('admin.dailyAyah.error.surah')
    : server.surah
      ? t(server.surah)
      : undefined;
  const ayahError = errors.ayah
    ? form.ayah.trim() === '' || surah === null || count === null
      ? t('admin.dailyAyah.error.ayah')
      : t.plural('admin.dailyAyah.error.notInSurah', count, {
          surah: formatNumber(surah, locale),
        })
    : server.ayah
      ? t(server.ayah)
      : undefined;

  const submit = async () => {
    const checked = validatePick(form, date, place, pick);
    setErrors(checked.errors);
    if (!checked.body) return;
    const saved = await save.run({ body: checked.body });
    if (saved) {
      await onSaved(t('admin.dailyAyah.saved', { reference: reference(saved), date: dateLabel }));
    }
  };

  const removeNow = async () => {
    if (!pick) return;
    const done = await remove.run(pick.id);
    // On a refusal the sheet closes and the message shows on the page (the sheet takes text only).
    setRemoving(false);
    if (done) {
      setForm(ayahFormOf(undefined));
      setErrors({});
      await onSaved(t('admin.dailyAyah.removed'));
    } else {
      // Someone may have changed it meanwhile (`not_found`): show what the server holds now.
      await onRefresh();
    }
  };

  const busy = save.status === 'running' || remove.status === 'running';

  return (
    <View style={{ gap: spacing.lg }} testID="daily-ayah-panel">
      <Card testID="daily-ayah-current">
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <Text variant="title3" heading={2}>
              {dateLabel}
            </Text>
            <Tag
              testID="daily-ayah-current-tag"
              label={pick ? t('admin.dailyAyah.yourPick') : t('admin.dailyAyah.noPick')}
              kind={pick ? 'ok' : 'neutral'}
            />
          </View>
          {pick ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <StarNumber value={pick.surah} />
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text variant="title2" testID="daily-ayah-current-ref">
                  {reference(pick)}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {place.type === 'venue'
                    ? t('admin.dailyAyah.whoSees.venue')
                    : t('admin.dailyAyah.whoSees.circle')}
                </Text>
              </View>
            </View>
          ) : (
            <Text color="textSecondary" testID="daily-ayah-current-none">
              {t('admin.dailyAyah.noPickHelp')}
            </Text>
          )}
          {pick ? (
            <Button
              testID="daily-ayah-remove"
              label={t('admin.dailyAyah.remove')}
              variant="outline"
              fullWidth
              disabled={busy}
              onPress={() => {
                remove.reset();
                setRemoving(true);
              }}
            />
          ) : null}
        </View>
      </Card>
      <ErrorNotice
        testID="daily-ayah-remove-error"
        error={removing ? null : remove.error}
        onDismiss={remove.reset}
      />

      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="title3" heading={2}>
              {pick ? t('admin.dailyAyah.form.titleChange') : t('admin.dailyAyah.form.titleNew')}
            </Text>
            <Text variant="caption" color="textSecondary">
              {t('admin.dailyAyah.form.help')}
            </Text>
          </View>
          <TextField
            testID="daily-ayah-surah"
            label={t('admin.dailyAyah.surah.label')}
            value={form.surah}
            onChangeText={(value) => patch({ surah: value })}
            error={surahError}
            keyboardType="number-pad"
            contentDirection="ltr"
            maxLength={3}
            required
            loading={busy}
          />
          <TextField
            testID="daily-ayah-ayah"
            label={t('admin.dailyAyah.ayah.label')}
            helper={
              surah !== null && count !== null
                ? t.plural('admin.dailyAyah.ayahCount', count, {
                    surah: formatNumber(surah, locale),
                  })
                : undefined
            }
            value={form.ayah}
            onChangeText={(value) => patch({ ayah: value })}
            error={ayahError}
            keyboardType="number-pad"
            contentDirection="ltr"
            maxLength={3}
            required
            loading={busy}
          />
        </View>
      </Card>

      <Card variant="flat" testID="daily-ayah-fallback">
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" heading={2}>
            {t('admin.dailyAyah.fallback.title')}
          </Text>
          <Text testID={`daily-ayah-fallback-${fallback.source}`}>
            {fallback.source === 'national'
              ? t('admin.dailyAyah.fallback.national', { reference: reference(fallback) })
              : t('admin.dailyAyah.fallback.builtIn', { reference: reference(fallback) })}
          </Text>
          <Text variant="caption" color="textSecondary">
            {t('admin.dailyAyah.fallback.note')}
          </Text>
        </View>
      </Card>

      {errors.same ? (
        <Text variant="caption" color="textDanger" testID="daily-ayah-same">
          {t('admin.dailyAyah.error.same')}
        </Text>
      ) : null}
      {errors.invalid ? (
        <Text variant="caption" color="textDanger" testID="daily-ayah-invalid">
          {t('errors.validation_failed')}
        </Text>
      ) : null}
      <ErrorNotice testID="daily-ayah-save-error" error={save.error} onDismiss={save.reset} />
      <ScreenFooter>
        <Button
          testID="daily-ayah-save"
          label={pick ? t('admin.dailyAyah.replace') : t('admin.dailyAyah.save')}
          size="large"
          fullWidth
          loading={save.status === 'running'}
          disabled={remove.status === 'running'}
          onPress={() => void submit()}
        />
      </ScreenFooter>

      <ConfirmSheet
        testID="daily-ayah-remove-confirm"
        visible={removing}
        title={t('admin.dailyAyah.remove.title')}
        message={t('admin.dailyAyah.remove.body', {
          date: dateLabel,
          reference: reference(fallback),
        })}
        confirmLabel={t('admin.dailyAyah.remove')}
        cancelLabel={t('admin.common.cancel')}
        destructive
        busy={remove.status === 'running'}
        onCancel={() => setRemoving(false)}
        onConfirm={() => void removeNow()}
      />
    </View>
  );
}

/** This place's picks in the days shown, each opening its day. */
function Upcoming({
  picks,
  selected,
  onSelect,
}: {
  picks: DailyAyahEntry[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const reference = useReference();
  const sorted = [...picks].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card testID="daily-ayah-upcoming">
      <View style={{ gap: spacing.sm }}>
        <Text variant="title3" heading={2}>
          {t('admin.dailyAyah.upcoming.title')}
        </Text>
        {sorted.length === 0 ? (
          <Text color="textSecondary" testID="daily-ayah-upcoming-empty">
            {t('admin.dailyAyah.upcoming.empty')}
          </Text>
        ) : (
          <View>
            {sorted.map((p, i) => {
              const dateLabel = formatLocalDate(p.date, locale);
              const ref = reference(p);
              return (
                <Pressable
                  key={p.id}
                  role="button"
                  testID={`daily-ayah-upcoming-${p.date}`}
                  aria-current={p.date === selected || undefined}
                  accessibilityLabel={t('admin.dailyAyah.upcoming.row', {
                    date: dateLabel,
                    reference: ref,
                  })}
                  onPress={() => onSelect(p.date)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    minHeight: minTouchTarget,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radii.md,
                    backgroundColor:
                      p.date === selected
                        ? colors.accentSubtle
                        : pressed
                          ? colors.surfaceMuted
                          : undefined,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  })}
                >
                  <StarNumber value={p.surah} />
                  <View style={{ flex: 1, gap: spacing.xxs }}>
                    <Text variant="label">{ref}</Text>
                    <Text variant="caption" color="textSecondary">
                      {dateLabel}
                    </Text>
                  </View>
                  <Icon
                    name="chevron-forward"
                    size={20}
                    color={p.date === selected ? colors.accent : colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </Card>
  );
}
