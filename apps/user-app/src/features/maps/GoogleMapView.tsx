import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@qc/ui';
import { ListOnlyMapView } from './ListOnlyMapView';
import { centerOf, type MapViewProps } from './types';

/**
 * Google Maps for the web target (the PWA), through the Maps JavaScript API. The key is public
 * configuration (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`) and must be restricted to our web origins in
 * the Google console. Phones use `GoogleMapView.native.tsx`. If the script cannot load, the
 * list-only map shows instead, so the screen never goes blank.
 */

type Json = Record<string, unknown>;
interface GoogleMapsApi {
  maps: {
    Map: new (
      el: HTMLElement,
      options: Json,
    ) => { setCenter(c: Json): void; fitBounds(b: unknown): void };
    Marker: new (options: Json) => {
      addListener(event: string, handler: () => void): void;
      setMap(map: unknown): void;
    };
    LatLngBounds: new () => { extend(p: Json): void };
  };
}
declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

let loading: Promise<GoogleMapsApi> | null = null;

function loadGoogleMaps(apiKey: string, language: string): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.maps) return Promise.resolve(window.google);
  loading ??= new Promise<GoogleMapsApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=${language}&loading=async`;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('no google')));
    script.onerror = () => {
      loading = null;
      reject(new Error('maps script failed'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

const styles = StyleSheet.create({ box: { width: '100%', borderRadius: 12, overflow: 'hidden' } });

export function GoogleMapView(props: MapViewProps) {
  const { markers, onSelect, height = 280, accessibilityLabel } = props;
  const theme = useTheme();
  const host = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !host.current) return;
    let cancelled = false;
    loadGoogleMaps(apiKey, theme.locale)
      .then((google) => {
        if (cancelled || !host.current) return;
        const center = props.center ?? centerOf(markers) ?? { lat: 30.3753, lng: 69.3451 };
        const map = new google.maps.Map(host.current, {
          center,
          zoom: markers.length > 0 ? 11 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const bounds = new google.maps.LatLngBounds();
        for (const marker of markers) {
          const position = { lat: marker.lat, lng: marker.lng };
          const pin = new google.maps.Marker({ position, map, title: marker.title });
          pin.addListener('click', () => onSelect(marker.id));
          bounds.extend(position);
        }
        if (markers.length > 1) map.fitBounds(bounds);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, markers, onSelect, props.center, theme.locale]);

  if (!apiKey || failed) return <ListOnlyMapView {...props} />;
  return (
    <View style={[styles.box, { height }]} role="application" aria-label={accessibilityLabel}>
      <div ref={host} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
