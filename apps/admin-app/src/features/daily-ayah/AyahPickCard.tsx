import { View } from 'react-native';
import { Button, Card, Icon, Text, spacing, useTheme } from '@qc/ui';
import { useFeatureFlag } from '../../api/featureFlags';
import { useT } from '../../appearance/AppearanceProvider';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { canPickFor, type AyahPlace } from './pick';

/**
 * The way in to the ayah of the day pick from a venue or circle page. Shown only when the
 * `ayah_of_the_day` flag is on for the place's city and the person may pick for the place;
 * while the flag loads, or when it cannot be read, nothing shows.
 */
export function AyahPickCard({ place }: { place: AyahPlace }) {
  const { t } = useT();
  const nav = useNavigation();
  const { colors } = useTheme();
  const { principal } = useWorkingScope();
  const allowed = canPickFor(principal, place);
  const flag = useFeatureFlag('ayah_of_the_day', place.cityId, { enabled: allowed });
  if (!allowed || flag.data !== true) return null;
  return (
    <Card testID="ayah-pick-card">
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="book" size={22} color={colors.textAccent} />
          <View style={{ flex: 1 }}>
            <Text variant="title3" heading={2}>
              {t('admin.dailyAyah.title')}
            </Text>
          </View>
        </View>
        <Text variant="caption" color="textSecondary">
          {place.type === 'venue'
            ? t('admin.dailyAyah.entry.help.venue')
            : t('admin.dailyAyah.entry.help.circle')}
        </Text>
        <Button
          testID="ayah-pick-open"
          label={t('admin.dailyAyah.entry.action')}
          variant="outline"
          fullWidth
          onPress={() =>
            nav.push(
              routes.dailyAyah(
                place.type === 'venue' ? { venueId: place.venueId } : { circleId: place.circleId },
              ),
            )
          }
        />
      </View>
    </Card>
  );
}
