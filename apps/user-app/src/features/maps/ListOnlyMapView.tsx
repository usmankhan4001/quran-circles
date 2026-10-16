import { StyleSheet, View } from 'react-native';
import { Card, Text, spacing } from '@qc/ui';
import { ltrRun } from '@qc/ui';
import type { MapViewProps } from './types';

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
});

/**
 * The map used when no map provider is set up: a plain list of the places with their
 * coordinates, selectable like pins. It keeps the screen honest and testable without a map.
 */
export function ListOnlyMapView({
  markers,
  selectedId,
  onSelect,
  accessibilityLabel,
  unavailableLabel,
}: MapViewProps) {
  return (
    <View testID="map-list-only" role="group" aria-label={accessibilityLabel} style={styles.stack}>
      <Text variant="caption" color="textSecondary">
        {unavailableLabel}
      </Text>
      {markers.map((marker) => (
        <Card
          key={marker.id}
          variant={marker.id === selectedId ? 'outlined' : 'flat'}
          padding="md"
          onPress={() => onSelect(marker.id)}
          accessibilityLabel={marker.title}
          testID={`map-marker-${marker.id}`}
        >
          <View style={styles.row}>
            <View style={styles.text}>
              <Text variant="label">{marker.title}</Text>
              {marker.subtitle ? (
                <Text variant="caption" color="textSecondary">
                  {marker.subtitle}
                </Text>
              ) : null}
              <Text variant="caption" color="textSecondary" direction="ltr">
                {ltrRun(`${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`)}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}
