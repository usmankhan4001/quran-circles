import { StyleSheet, View } from 'react-native';
import { Icon, Text, spacing, useTheme } from '@qc/ui';
import type { VenueFacilities } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';

export const FACILITY_KEYS = [
  'womenSection',
  'parking',
  'wuduArea',
  'elderWheelchairAccess',
  'childFriendly',
] as const satisfies readonly (keyof VenueFacilities)[];

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  label: { flex: 1 },
});

/**
 * The fixed facilities checklist of a venue. Each line says "Available" or "Not listed" in
 * words as well as with an icon, so it does not depend on colour or shape.
 */
export function FacilitiesChecklist({ facilities }: { facilities: VenueFacilities }) {
  const { t, l } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  const notes = facilities.entranceNotes ? l(facilities.entranceNotes) : null;
  return (
    <View style={styles.list} testID="facilities">
      {FACILITY_KEYS.map((key) => {
        const yes = facilities[key];
        return (
          <View
            key={key}
            style={styles.row}
            testID={`facility-${key}`}
            accessible
            aria-label={`${t(`facilities.${key}`)}: ${yes ? t('facilities.available') : t('facilities.notListed')}`}
          >
            <Icon
              name={yes ? 'success' : 'close'}
              size={22}
              color={yes ? c.success : c.textSecondary}
            />
            <View style={styles.label}>
              <Text variant="body" decorative>
                {t(`facilities.${key}`)}
              </Text>
            </View>
            <Text variant="caption" color={yes ? 'textSuccess' : 'textSecondary'} decorative>
              {yes ? t('facilities.available') : t('facilities.notListed')}
            </Text>
          </View>
        );
      })}
      {notes ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text variant="label">{t('facilities.entranceNotes')}</Text>
          <Text variant="body" lang={notes.lang}>
            {notes.text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
