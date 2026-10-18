import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text, radii, spacing, useTheme } from '@qc/ui';
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
  chips: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xxs,
    paddingVertical: spacing.xs + spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});

/**
 * The facilities a venue has as pills with a tick (D17). `scroll` is the session page's single
 * grey row that scrolls sideways; `badges` is the venue page's emerald badges that wrap, with
 * what is not listed said in words under them. The venue page's older full checklist is below.
 */
export function FacilityChips({
  facilities,
  variant = 'scroll',
}: {
  facilities: VenueFacilities;
  variant?: 'scroll' | 'badges';
}) {
  const { t, l } = useI18n();
  const theme = useTheme();
  const c = theme.colors;
  const hc = theme.mode === 'highContrast';
  const notes = facilities.entranceNotes ? l(facilities.entranceNotes) : null;
  const present = FACILITY_KEYS.filter((key) => facilities[key]);
  const missing = FACILITY_KEYS.filter((key) => !facilities[key]);
  const badges = variant === 'badges';
  const chips = present.map((key) => (
    <View
      key={key}
      role="listitem"
      testID={`facility-${key}`}
      style={[
        styles.chip,
        badges
          ? { backgroundColor: c.accentSubtle, borderColor: hc ? c.borderStrong : c.accentSubtle }
          : { backgroundColor: c.surfaceMuted, borderColor: hc ? c.borderStrong : c.hairline },
      ]}
    >
      <Icon name="check" size={16} color={badges ? c.textOnAccentSubtle : c.textAccent} />
      <Text variant="caption" color={badges ? 'textOnAccentSubtle' : 'textSecondary'} strong>
        {t(`facilities.${key}`)}
      </Text>
    </View>
  ));
  return (
    <View style={styles.list} testID="facilities">
      {present.length === 0 ? (
        <Text variant="body" color="textSecondary">
          {t('facilities.noneListed')}
        </Text>
      ) : badges ? (
        <View style={[styles.chips, styles.wrap]} role="list">
          {chips}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          role="list"
        >
          {chips}
        </ScrollView>
      )}
      {badges && present.length > 0 && missing.length > 0 ? (
        <Text variant="caption" color="textSecondary" testID="facilities-missing">
          {t('facilities.notListedList', {
            list: missing.map((key) => t(`facilities.${key}`)).join(t('facilities.joiner')),
          })}
        </Text>
      ) : null}
      {notes ? (
        <Text variant="caption" color="textSecondary" lang={notes.lang}>
          {notes.text}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The fixed facilities checklist of a venue. Each line says "Available" or "Not listed" in
 * words as well as with an icon, so it does not depend on colour or shape.
 *
 * A screen reader reads the two words of a line as its text ("Women's section, Available"):
 * the line is grouped into one stop on a phone (`accessible`), and on the web the words are
 * plain text. A name on the line itself would be ignored on the web, where it is a plain `div`
 * (axe `aria-prohibited-attr`), and the words would then be silent.
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
          <View key={key} style={styles.row} testID={`facility-${key}`} accessible>
            <Icon
              name={yes ? 'success' : 'close'}
              size={22}
              color={yes ? c.success : c.textSecondary}
            />
            <View style={styles.label}>
              <Text variant="body">{t(`facilities.${key}`)}</Text>
            </View>
            <Text variant="caption" color={yes ? 'textSuccess' : 'textSecondary'}>
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
