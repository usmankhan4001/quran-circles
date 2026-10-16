import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { KeyValueStore } from '../core/storage';

/** Preferences and the offline copy of public data. Not secret. */
export function createDeviceStore(): KeyValueStore {
  return {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    remove: (key) => AsyncStorage.removeItem(key),
  };
}

/**
 * Where sign-in tokens live. On a phone that is the keychain or keystore. The PWA has no
 * secure storage, so it uses local storage for this origin, the usual choice for a web app;
 * the refresh token rotates on every use and reuse signs the device out.
 */
export function createTokenStore(): KeyValueStore {
  if (Platform.OS === 'web') return createDeviceStore();
  return {
    get: (key) => SecureStore.getItemAsync(key),
    set: (key, value) => SecureStore.setItemAsync(key, value),
    remove: (key) => SecureStore.deleteItemAsync(key),
  };
}
