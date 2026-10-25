import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ScreenHeader, SegmentedControl, screenGutter, spacing } from '@qc/ui';
import type { Section } from '../state/viewState';
import { useContentI18n } from './i18n';

export interface QuranHubHeaderProps {
  section: Section;
  onSectionChange: (section: Section) => void;
  /** A line above the title: the reading line for the Quran, the city for prayer times. */
  meta?: string;
  /** More at the end of the title row, such as the app's profile button. */
  actions?: ReactNode;
  testID?: string;
}

/**
 * The top of the Quran & Prayer tab: a muted line, the large title on the white page, and the
 * Quran / Prayer times switch under it. No coloured band.
 */
export function QuranHubHeader({
  section,
  onSectionChange,
  meta,
  actions,
  testID,
}: QuranHubHeaderProps) {
  const i18n = useContentI18n();
  return (
    <View testID={testID} style={{ paddingHorizontal: screenGutter, gap: spacing.sm }}>
      <ScreenHeader
        title={i18n.t('tabs.quranPrayer')}
        meta={meta ?? i18n.t('quran.hub.subtitle')}
        trailing={actions}
      />
      <SegmentedControl<Section>
        accessibilityLabel={i18n.t('tabs.quranPrayer')}
        value={section}
        onChange={onSectionChange}
        options={[
          { value: 'quran', label: i18n.t('quran.tab.quran') },
          { value: 'prayer', label: i18n.t('quran.tab.prayer') },
        ]}
        testID="section-switch"
      />
    </View>
  );
}
