import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ListOnlyMapView } from './ListOnlyMapView';
import { centerOf, type MapViewProps } from './types';

/**
 * Google Maps on iOS and Android through react-native-maps. The native keys are public
 * configuration in `app.config.ts` (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`), restricted to the app
 * ids in the Google console. Without a key the list-only map shows.
 */
const styles = StyleSheet.create({ box: { width: '100%', borderRadius: 12, overflow: 'hidden' } });

export function GoogleMapView(props: MapViewProps) {
  const { markers, onSelect, height = 280, accessibilityLabel } = props;
  if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) return <ListOnlyMapView {...props} />;
  const center = props.center ?? centerOf(markers) ?? { lat: 30.3753, lng: 69.3451 };
  return (
    <View style={[styles.box, { height }]} accessibilityLabel={accessibilityLabel}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: markers.length > 1 ? 0.25 : 0.05,
          longitudeDelta: markers.length > 1 ? 0.25 : 0.05,
        }}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            title={marker.title}
            description={marker.subtitle}
            onPress={() => onSelect(marker.id)}
          />
        ))}
      </MapView>
    </View>
  );
}
