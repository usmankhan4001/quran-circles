import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text, spacing } from '@qc/ui';
import { useArtSize } from './art';
import { PillCta, StatusLine, WhiteCard } from './parts';

export interface QuranLeadCardProps {
  /** The short status line by the green dot, such as "Continue reading". */
  status: string;
  /** Text at the end of the status line, such as how far through the surah. */
  progress?: string;
  title: string;
  /** One quiet line under the title: the place, the venue. */
  detail?: string;
  detailTestID?: string;
  /** The surah's Arabic name, at the end of the title row. */
  arabicName?: string;
  /** A short preview under the title, such as the Arabic of the ayah to read next. */
  preview?: ReactNode;
  actionLabel: string;
  actionAccessibilityLabel?: string;
  onAction: () => void;
  actionTestID?: string;
  testID?: string;
}

/**
 * The card that leads the Quran half of the tab (D17), half on the green: a green dot and a
 * status line, the title with the surah's Arabic name at its end, an optional preview, and an
 * outline pill to carry on.
 */
export function QuranLeadCard({
  status,
  progress,
  title,
  detail,
  detailTestID = 'lead-detail',
  arabicName,
  preview,
  actionLabel,
  actionAccessibilityLabel,
  onAction,
  actionTestID,
  testID,
}: QuranLeadCardProps) {
  const size = useArtSize();
  return (
    <WhiteCard testID={testID} padding={16}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginBottom: 6,
        }}
      >
        <StatusLine label={status} />
        {progress ? (
          <Text
            variant="caption"
            color="textSuccess"
            strong

            testID="lead-progress"
          >
            {progress}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text variant="title3" heading={2} testID="lead-title">
            {title}
          </Text>
          {detail ? (
            <Text
              variant="caption"
              color="textSecondary"
              style={{ marginTop: 2 }}
              testID={detailTestID}
            >
              {detail}
            </Text>
          ) : null}
        </View>
        {arabicName ? (
          <Text variant="quran" lang="ar" decorative style={size(20, 'quran', 'quran')}>
            {arabicName}
          </Text>
        ) : null}
      </View>
      {preview ? <View style={{ marginTop: 10, marginBottom: 4 }}>{preview}</View> : null}
      <View style={{ marginTop: 8 }}>
        <PillCta
          label={actionLabel}
          height={36}
          onPress={onAction}
          {...(actionAccessibilityLabel ? { accessibilityLabel: actionAccessibilityLabel } : {})}
          {...(actionTestID ? { testID: actionTestID } : {})}
        />
      </View>
    </WhiteCard>
  );
}
