import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, spacing, useTheme } from '@qc/ui';
import { MapPin } from '../../ui/MapPin';
import type { MapViewProps } from './types';

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  noticeText: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
});

/**
 * The map used when no map provider is set up: a plain list of the places, selectable like
 * pins. Each place says where it is in words (area, city, and how far when known), never as
 * coordinates. It keeps the screen honest and testable without a map.
 */
export function ListOnlyMapView({
  markers,
  selectedId,
  onSelect,
  accessibilityLabel,
  unavailableLabel,
}: MapViewProps) {
  const c = useTheme().colors;
  return (
    <View testID="map-list-only" role="group" aria-label={accessibilityLabel} style={styles.stack}>
      <View style={styles.notice} testID="map-unavailable">
        <Icon name="map-pin" size={16} color={c.textSecondary} />
        <Text variant="caption" color="textSecondary" style={styles.noticeText}>
          {unavailableLabel}
        </Text>
      </View>
      {markers.map((marker) => (
        <Card
          key={marker.id}
          variant={marker.id === selectedId ? 'outlined' : 'flat'}
          padding="md"
          onPress={() => onSelect(marker.id)}
          accessibilityLabel={[marker.title, marker.location].filter(Boolean).join(', ')}
          testID={`map-marker-${marker.id}`}
        >
          <View style={styles.row}>
            <MapPin
              count={marker.count ?? 1}
              selected={marker.id === selectedId}
              testID={`map-pin-${marker.id}`}
            />
            <View style={styles.text}>
              <Text variant="label">{marker.title}</Text>
              {marker.subtitle ? (
                <Text variant="caption" color="textSecondary">
                  {marker.subtitle}
                </Text>
              ) : null}
              {marker.location ? (
                <Text
                  variant="caption"
                  color="textSecondary"
                  testID={`map-marker-location-${marker.id}`}
                >
                  {marker.location}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}
