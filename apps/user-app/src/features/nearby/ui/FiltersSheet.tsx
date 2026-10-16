import { StyleSheet, View } from 'react-native';
import { Button, Chip, Sheet, Text, spacing } from '@qc/ui';
import { LOCALES, SECTIONS, PROGRAMS } from '@qc/contracts';
import { DAY_KEYS } from '../../../core/format';
import { useI18n } from '../../../i18n/I18nProvider';
import { TIME_BANDS, emptyFilters, toggleIn, type NearbyFilters } from '../filters';

const styles = StyleSheet.create({
  group: { gap: spacing.sm, marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});

export interface FiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: NearbyFilters;
  onChange: (next: NearbyFilters) => void;
}

/** Day, time, section, language and program: the chips behind the Filters button. */
export function FiltersSheet({ visible, onClose, filters, onChange }: FiltersSheetProps) {
  const { t } = useI18n();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('nearby.filters.title')} testID="filters-sheet">
      <View style={styles.group} role="group" aria-label={t('nearby.filters.day')}>
        <Text variant="label">{t('nearby.filters.day')}</Text>
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

      <View style={styles.group} role="group" aria-label={t('nearby.filters.time')}>
        <Text variant="label">{t('nearby.filters.time')}</Text>
        <View style={styles.chips}>
          {TIME_BANDS.map((band) => (
            <Chip
              key={band}
              label={t(`nearby.time.${band}`)}
              selected={filters.timeBand === band}
              onPress={() => onChange({ ...filters, timeBand: filters.timeBand === band ? null : band })}
              testID={`filter-time-${band}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.group} role="group" aria-label={t('nearby.filters.section')}>
        <Text variant="label">{t('nearby.filters.section')}</Text>
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

      <View style={styles.group} role="group" aria-label={t('nearby.filters.language')}>
        <Text variant="label">{t('nearby.filters.language')}</Text>
        <View style={styles.chips}>
          {LOCALES.map((language) => (
            <Chip
              key={language}
              label={t(`languages.${language}`)}
              selected={filters.language === language}
              onPress={() =>
                onChange({ ...filters, language: filters.language === language ? null : language })
              }
              testID={`filter-language-${language}`}
            />
          ))}
        </View>
      </View>

      <View style={styles.group} role="group" aria-label={t('nearby.filters.program')}>
        <Text variant="label">{t('nearby.filters.program')}</Text>
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

      <View style={styles.actions}>
        <Button label={t('nearby.filters.apply')} fullWidth onPress={onClose} testID="filters-apply" />
        <Button
          variant="tertiary"
          fullWidth
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
    </Sheet>
  );
}
