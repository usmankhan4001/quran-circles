import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Icon, Sheet, Text, radii, spacing, useTheme } from '@qc/ui';
import { LOCALES, SECTIONS, PROGRAMS } from '@qc/contracts';
import { DAY_KEYS } from '../../../core/format';
import { useI18n } from '../../../i18n/I18nProvider';
import { TIME_BANDS, emptyFilters, toggleIn, type NearbyFilters, type TimeBand } from '../filters';

const styles = StyleSheet.create({
  reset: { alignItems: 'flex-end', marginTop: -spacing.sm },
  group: { gap: spacing.md, marginBottom: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  band: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + spacing.xxs,
    paddingVertical: spacing.sm,
    borderRadius: radii.md + spacing.xxs,
  },
  actions: { marginTop: spacing.sm },
});

export interface FiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: NearbyFilters;
  onChange: (next: NearbyFilters) => void;
  /** How many circles match now, when the whole list is known; the button then says so. */
  matching?: number | null;
}

/** One time band as a tile of the two-by-two grid (D17): emerald tint with a tick when chosen. */
function BandTile({
  band,
  selected,
  onPress,
}: {
  band: TimeBand;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      onPress={onPress}
      testID={`filter-time-${band}`}
      style={({ pressed }) => [
        styles.band,
        {
          backgroundColor: selected ? c.accentSubtle : pressed ? c.surfaceMuted : c.surface,
          borderWidth: selected ? 1.5 : 1,
          borderColor:
            theme.mode === 'highContrast' ? c.borderStrong : selected ? c.progress : c.border,
        },
      ]}
    >
      <Text variant="label" color={selected ? 'textOnAccentSubtle' : 'text'}>
        {t(`nearby.time.${band}`)}
      </Text>
      {selected ? <Icon name="check-circle" size={16} color={c.progress} /> : null}
    </Pressable>
  );
}

/**
 * The filters sheet (D17): "Clear filters" at the top, the time of day as a grid of four tiles,
 * then section, programme, language and day as pills, and one charcoal button that shows the
 * matching circles.
 */
export function FiltersSheet({ visible, onClose, filters, onChange, matching }: FiltersSheetProps) {
  const { t } = useI18n();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('nearby.filters.title')}
      testID="filters-sheet"
    >
      <View style={styles.reset}>
        <Button
          variant="tertiary"
          label={t('nearby.filters.clear')}
          onPress={() =>
            onChange({
              ...emptyFilters,
              cityId: filters.cityId,
              areaId: filters.areaId,
              q: filters.q,
            })
          }
          testID="filters-clear"
        />
      </View>

      <View style={styles.group} role="radiogroup" aria-label={t('nearby.filters.time')}>
        <Text variant="label" heading={3}>
          {t('nearby.filters.time')}
        </Text>
        <View style={styles.grid}>
          {TIME_BANDS.map((band) => (
            <BandTile
              key={band}
              band={band}
              selected={filters.timeBand === band}
              onPress={() =>
                onChange({ ...filters, timeBand: filters.timeBand === band ? null : band })
              }
            />
          ))}
        </View>
      </View>

      <View style={styles.group} role="group" aria-label={t('nearby.filters.section')}>
        <Text variant="label" heading={3}>
          {t('nearby.filters.section')}
        </Text>
        <View style={styles.chips}>
          {SECTIONS.map((section) => (
            <Chip
              key={section}
              label={t(`sections.${section}`)}
              selected={filters.section === section}
              onPress={() =>
                onChange({ ...filters, section: filters.section === section ? null : section })
              }
              testID={`filter-section-${section}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.group} role="group" aria-label={t('nearby.filters.program')}>
        <Text variant="label" heading={3}>
          {t('nearby.filters.program')}
        </Text>
        <View style={styles.chips}>
          {PROGRAMS.map((program) => (
            <Chip
              key={program}
              label={t(`programs.${program}`)}
              selected={filters.program === program}
              onPress={() =>
                onChange({ ...filters, program: filters.program === program ? null : program })
              }
              testID={`filter-program-${program}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.group} role="group" aria-label={t('nearby.filters.language')}>
        <Text variant="label" heading={3}>
          {t('nearby.filters.language')}
        </Text>
        <View style={styles.chips}>
          {LOCALES.map((language) => (
            <Chip
              key={language}
              label={t(`profile.language.${language}`)}
              selected={filters.language === language}
              onPress={() =>
                onChange({ ...filters, language: filters.language === language ? null : language })
              }
              testID={`filter-language-${language}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.group} role="group" aria-label={t('nearby.filters.day')}>
        <Text variant="label" heading={3}>
          {t('nearby.filters.day')}
        </Text>
        <View style={styles.chips}>
          {DAY_KEYS.map((key, day) => (
            <Chip
              key={key}
              label={t(key)}
              selected={filters.days.includes(day)}
              onPress={() => onChange({ ...filters, days: toggleIn(filters.days, day) })}
              testID={`filter-day-${day}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          size="large"
          label={
            typeof matching === 'number'
              ? t('nearby.filters.showCount', { count: matching })
              : t('nearby.filters.apply')
          }
          fullWidth
          onPress={onClose}
          testID="filters-apply"
        />
      </View>
    </Sheet>
  );
}
