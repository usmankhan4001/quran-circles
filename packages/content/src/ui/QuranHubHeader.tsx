import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { HeroHeader, Text, radii, spacing, useTheme } from '@qc/ui';
import type { Section } from '../state/viewState';
import { useContentI18n } from './i18n';

export interface QuranHubHeaderProps {
  section: Section;
  onSectionChange: (section: Section) => void;
  /** More buttons at the end of the top row, such as the app's profile button. */
  actions?: ReactNode;
  testID?: string;
}

/**
 * The green top of the Quran & Prayer tab (D17): the title and a short line on the start, the
 * Quran / Prayer switch on the end. The lead card of each half sits half on its lower fade.
 */
export function QuranHubHeader({ section, onSectionChange, actions, testID }: QuranHubHeaderProps) {
  const i18n = useContentI18n();
  return (
    <HeroHeader
      testID={testID}
      leading={
        <View style={{ flexShrink: 1, gap: spacing.xxs, paddingEnd: spacing.sm }}>
          <Text variant="title2" color="textOnHero" heading={1}>
            {i18n.t('quran.hub.title')}
          </Text>
          <Text variant="caption" color="textOnHero" style={{ opacity: 0.86 }}>
            {i18n.t('quran.hub.subtitle')}
          </Text>
        </View>
      }
      actions={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <HeroSwitch
            accessibilityLabel={i18n.t('tabs.quranPrayer')}
            value={section}
            onChange={onSectionChange}
            options={[
              { value: 'quran', label: i18n.t('quran.tab.quran') },
              { value: 'prayer', label: i18n.t('quran.tab.prayerShort') },
            ]}
            testID="section-switch"
          />
          {actions}
        </View>
      }
    />
  );
}

interface HeroSwitchProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  accessibilityLabel: string;
  testID?: string;
}

/**
 * A two-way switch on the green: a glass track, the chosen side a white pill with green text.
 * TODO(ui lane): an `onHero` look for the kit's SegmentedControl would replace this.
 */
function HeroSwitch<T extends string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  testID,
}: HeroSwitchProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  const hc = theme.mode === 'highContrast';
  return (
    <View
      role="radiogroup"
      aria-label={accessibilityLabel}
      testID={testID}
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: radii.pill,
        backgroundColor: c.heroGlass,
        borderWidth: hc ? 1 : 0,
        borderColor: c.textOnHero,
      }}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={chosen}
            onPress={() => onChange(option.value)}
            testID={testID ? `${testID}-${option.value}` : undefined}
            hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }}
            style={({ pressed }) => ({
              paddingVertical: 4,
              paddingHorizontal: 11,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: chosen ? c.surface : pressed ? c.heroGlassPressed : 'transparent',
            })}
          >
            <Text variant="caption" strong color={chosen ? 'textAccent' : 'textOnHero'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
