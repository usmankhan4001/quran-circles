import { View } from 'react-native';
import type { AdminSession } from '@qc/contracts';
import { Icon, Text, radii, spacing, useTheme } from '@qc/ui';
import { useT } from '../../appearance/AppearanceProvider';
import { pickLocalized } from '../../lib/localized';
import { whenSummary } from '../home/sessionText';

/**
 * D17 poster preview: the green poster as the session prints it, drawn from the session itself
 * (venue, both titles, when, teacher). The square stands in for the QR code, which is only in the
 * made file.
 */
export function PosterPreview({ session }: { session: AdminSession }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const teacher = session.circle?.teacherName ?? null;
  const when = [whenSummary(session, t, locale), teacher].filter(Boolean).join(' · ');
  return (
    <View
      testID="posters-preview"
      style={{
        gap: spacing.sm,
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: radii.card,
        backgroundColor: colors.hero,
      }}
    >
      <Text variant="caption" color="textOnHero" strong align="center">
        {pickLocalized(session.venue.name, locale)}
      </Text>
      {session.title.ur ? (
        <Text variant="title2" color="textOnHero" lang="ur" align="center">
          {session.title.ur}
        </Text>
      ) : null}
      {session.title.en ? (
        <Text variant="title3" color="textOnHero" lang="en" strong align="center">
          {session.title.en}
        </Text>
      ) : null}
      <Text variant="caption" color="textOnHero" align="center">
        {when}
      </Text>
      <View
        aria-hidden
        style={{
          alignSelf: 'stretch',
          alignItems: 'center',
          gap: spacing.sm,
          marginHorizontal: spacing.xl,
          paddingVertical: spacing.lg,
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
        }}
      >
        <Icon name="qr-code" size={56} color={colors.text} />
        <Text variant="caption" strong align="center" decorative>
          {t('admin.posters.preview.scan')}
        </Text>
      </View>
      <Text variant="caption" color="textOnHero" align="center">
        {t('admin.posters.source.note')}
      </Text>
    </View>
  );
}
