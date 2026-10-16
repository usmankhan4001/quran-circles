import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { EmptyState, ListItem, Sheet, Skeleton, TextField } from '@qc/ui';
import { filterAreas, useAreas } from '../features/places/usePlaces';
import { useI18n } from '../i18n/I18nProvider';

export interface AreaPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  cityId: string | null;
  value: string | null;
  onChange: (areaId: string | null) => void;
  /** Adds an "All areas" row at the top, for filters. Registration needs a real area. */
  allowAll?: boolean;
}

/** Area search over our own place list: type to narrow the areas of the city, then pick one. */
export function AreaPickerSheet({
  visible,
  onClose,
  cityId,
  value,
  onChange,
  allowAll,
}: AreaPickerSheetProps) {
  const { t, l } = useI18n();
  const areas = useAreas(cityId);
  const [search, setSearch] = useState('');
  const shown = useMemo(() => filterAreas(areas.data ?? [], search), [areas.data, search]);

  const choose = (areaId: string | null) => {
    onChange(areaId);
    setSearch('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('nearby.area.title')} testID="area-sheet">
      {!cityId ? (
        <EmptyState title={t('nearby.area.chooseCityFirst')} />
      ) : areas.status === 'loading' ? (
        <Skeleton shape="text" lines={4} announce />
      ) : (
        <View>
          <TextField
            label={t('nearby.area.searchLabel')}
            placeholder={t('nearby.area.searchPlaceholder')}
            value={search}
            onChangeText={setSearch}
            testID="area-search"
          />
          <View role="radiogroup" aria-label={t('nearby.area.title')}>
            {allowAll ? (
              <ListItem
                title={t('nearby.area.all')}
                role="radio"
                checked={value === null}
                chevron={false}
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
                  onPress={() => choose(area.id)}
                  testID={`area-option-${area.id}`}
                />
              );
            })}
          </View>
          {shown.length === 0 ? <EmptyState title={t('nearby.area.noMatch')} /> : null}
        </View>
      )}
    </Sheet>
  );
}
