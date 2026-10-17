import { View } from 'react-native';
import { Text, spacing, useTheme } from '@qc/ui';
import { splitBismillah } from '../quran/bismillah';
import { useAyah } from './hooks';
import { useContentI18n } from './i18n';

export interface QuranTextCreditProps {
  testID?: string;
}

/**
 * The source of the Arabic text, shown wherever Quran text is shown (the reader and a single
 * ayah). The text comes from the online source at run time; see docs/product/decisions.md
 * (Quran and prayer, text and rights).
 */
export function QuranTextCredit({ testID = 'quran-text-credit' }: QuranTextCreditProps) {
  const i18n = useContentI18n();
  return (
    <Text variant="caption" color="textSecondary" align="center" testID={testID}>
      {i18n.t('quran.credit.arabic')}
    </Text>
  );
}

export interface SavedMarkProps {
  /** The words a screen reader says. Leave out when the row already says it. */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * The "saved on this phone" mark of the surah list: a downward arrow onto a line, as drawn.
 * The kit has no download icon yet, so it is drawn here with views. It is symmetric, so it
 * needs no mirroring in right-to-left.
 */
export function SavedMark({ accessibilityLabel, testID }: SavedMarkProps) {
  const theme = useTheme();
  const color = theme.colors.textAccent;
  const s = Math.round(16 * theme.scale);
  const w = Math.max(1.5, 1.75 * theme.scale);
  const c = s * 0.34;
  const tipY = s * 0.66;
  const line = { position: 'absolute', backgroundColor: color } as const;
  return (
    <View
      testID={testID}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={accessibilityLabel ? undefined : true}
      style={{ width: s, height: s }}
    >
      <View
        style={[line, { left: (s - w) / 2, top: s * 0.08, width: w, height: tipY - s * 0.08 }]}
      />
      <View
        style={{
          position: 'absolute',
          left: (s - c) / 2,
          top: tipY - c * 0.707 - c / 2,
          width: c,
          height: c,
          borderColor: color,
          // Physical on purpose: the arrow is symmetric and must point down in both directions.
          borderRightWidth: w,
          borderBottomWidth: w,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View style={[line, { left: s * 0.15, top: s * 0.84, width: s * 0.7, height: w }]} />
    </View>
  );
}

export interface AyahTextProps {
  surah: number;
  ayah: number;
  /** Show the Urdu translation under the Arabic. Default: on an Urdu screen only. */
  showTranslation?: boolean;
  testID?: string;
}

/**
 * The words of one ayah: the Arabic in the Quran font, the Urdu translation when asked, and the
 * text credit. Only that ayah is fetched (or read from a cached surah or juz that holds it).
 * Nothing is drawn while it loads or when it cannot be had, so a card can keep just its
 * reference. Ayah 1 is shown without the opening formula, as in the reader.
 */
export function AyahText({ surah, ayah, showTranslation, testID = 'ayah-text' }: AyahTextProps) {
  const i18n = useContentI18n();
  const state = useAyah(surah, ayah);
  if (state.status !== 'ready') return null;
  const { verse } = state.ayah;
  const withTranslation = showTranslation ?? i18n.locale === 'ur';
  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <Text variant="quran" lang="ar" align="center" selectable testID={`${testID}-arabic`}>
        {splitBismillah(verse).text}
      </Text>
      {withTranslation && verse.urdu ? (
        <Text lang="ur" selectable testID={`${testID}-translation`}>
          {verse.urdu}
        </Text>
      ) : null}
      <QuranTextCredit testID={`${testID}-credit`} />
    </View>
  );
}
