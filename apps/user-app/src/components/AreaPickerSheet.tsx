import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Chip,
  EmptyState,
  Icon,
  ListItem,
  SearchField,
  Sheet,
  Skeleton,
  spacing,
  useTheme,
} from '@qc/ui';
import { filterAreas, useAreas, useCities } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';

export interface AreaPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  cityId: string | null;
  value: string | null;
  onChange: (areaId: string | null) => void;
  /** Adds an "All areas" row at the top, for filters. Registration needs a real area. */
  allowAll?: boolean;
  /**
   * Shows a row of city pills above the areas (Home's "Choose your area", D17), so the person
   * can change city and area in one place. Leave it out to pick within one city only.
   */
  onCityChange?: (cityId: string) => void;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  cities: { gap: spacing.sm, paddingVertical: spacing.xxs },
});

/**
 * Area search over our own place list (D17 sheet): a grey search pill, the city pills when the
 * city can change here too, then the areas of the city with a pin each; the chosen one is ticked.
 */
export function AreaPickerSheet({
  visible,
  onClose,
  cityId,
  value,
  onChange,
  allowAll,
  onCityChange,
}: AreaPickerSheetProps) {
  const { t, l } = useI18n();
  const c = useTheme().colors;
  const areas = useAreas(cityId);
  const cities = useCities();
  const [search, setSearch] = useState('');
  const shown = useMemo(() => filterAreas(areas.data ?? [], search), [areas.data, search]);

  const choose = (areaId: string | null) => {
    onChange(areaId);
    setSearch('');
    onClose();
  };

  const pin = (chosen: boolean) => (
    <Icon name="pin" size={20} color={chosen ? c.textAccent : c.textMuted} />
  );

  const cityRow = onCityChange ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.cities}
      role="radiogroup"
      aria-label={t('nearby.area.city')}
      testID="area-cities"
    >
      {(cities.data ?? []).map((city) => (
        <Chip
          key={city.id}
          label={l(city.name).text}
          selected={city.id === cityId}
          onPress={() => {
            setSearch('');
            onCityChange(city.id);
          }}
          testID={`area-city-${city.id}`}
        />
      ))}
    </ScrollView>
  ) : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('nearby.area.title')} testID="area-sheet">
      <View style={styles.stack}>
        {cityId ? (
          <SearchField
            accessibilityLabel={t('nearby.area.searchLabel')}
            placeholder={t('nearby.area.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            testID="area-search"
          />
        ) : null}
        {cityRow}
        {!cityId ? (
          <EmptyState title={t('nearby.area.chooseCityFirst')} />
        ) : areas.status === 'loading' ? (
          <Skeleton shape="text" lines={4} announce />
        ) : (
          <View>
            <View role="radiogroup" aria-label={t('nearby.area.title')}>
              {allowAll ? (
                <ListItem
                  title={t('nearby.area.all')}
                  role="radio"
                  checked={value === null}
                  chevron={false}
                  leading={pin(value === null)}
                  onPress={() => choose(null)}
                  testID="area-option-all"
                />
              ) : null}
              {shown.map((area) => {
                const name = l(area.name);
                return (
                  <ListItem
                    key={area.id}
                    title={name.text}
                    role="radio"
                    checked={value === area.id}
                    selected={value === area.id}
                    chevron={false}
                    leading={pin(value === area.id)}
                    onPress={() => choose(area.id)}
                    testID={`area-option-${area.id}`}
                  />
                );
              })}
            </View>
            {shown.length === 0 ? <EmptyState title={t('nearby.area.noMatch')} /> : null}
          </View>
        )}
      </View>
    </Sheet>
  );
}
