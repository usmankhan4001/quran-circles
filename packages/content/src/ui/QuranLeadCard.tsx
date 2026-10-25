import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text, spacing, useTheme } from '@qc/ui';
import { useArtSize } from './art';
import { StatusLine, WhiteCard } from './parts';

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
  /** A short preview under the title. */
  preview?: ReactNode;
  /** Kept for callers that show a labelled action; the whole card opens the place. */
  actionLabel: string;
  actionAccessibilityLabel?: string;
  onAction: () => void;
  actionTestID?: string;
  /** Grey fill instead of the hairline, for the second lead card. */
  quiet?: boolean;
  testID?: string;
}

/**
 * The card that leads the Quran half of the tab: a green dot and a status line, the title with
 * the surah's Arabic name at its end, and one quiet line. The whole card is the button.
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
  quiet,
  testID,
}: QuranLeadCardProps) {
  const size = useArtSize();
  const c = useTheme().colors;
  return (
    <Pressable
      role="button"
      aria-label={actionAccessibilityLabel ?? `${status}. ${title}. ${actionLabel}`}
      onPress={onAction}
      testID={actionTestID}
    >
      {({ pressed }) => (
        <WhiteCard
          testID={testID}
          padding={16}
          style={[
            { gap: spacing.sm },
            quiet ? { backgroundColor: c.surfaceMuted, borderColor: c.surfaceMuted } : null,
            pressed ? { opacity: 0.85 } : null,
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <StatusLine label={status} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title3" heading={2} testID="lead-title">
                {title}
              </Text>
              {detail ? (
                <Text variant="caption" color="textMuted" testID={detailTestID}>
                  {detail}
                </Text>
              ) : null}
            </View>
            {arabicName ? (
              <Text variant="quran" lang="ar" decorative style={size(22, 'quran', 'quran')}>
                {arabicName}
              </Text>
            ) : progress ? (
              <Text variant="caption" color="textMuted" testID="lead-progress">
                {progress}
              </Text>
            ) : null}
          </View>
          {preview}
        </WhiteCard>
      )}
    </Pressable>
  );
}
