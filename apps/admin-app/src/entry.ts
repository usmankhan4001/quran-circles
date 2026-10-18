/**
 * The app's entry point (package.json `main`), in place of `expo-router/entry`.
 *
 * On the web, expo-router loads each route's code on demand, one round trip after the screen
 * above it has run. On a slow connection that is three trips in a row before Today can draw: the
 * root layout, the tabs and Today. Importing those three here puts them in the main bundle, which
 * already downloads at full speed, so Today draws as soon as the main bundle has run. Every other
 * route still loads on demand. iOS and Android bundle everything anyway. On the web, Today's
 * sessions are asked for as soon as the early `me` answer is in (boot/earlyToday.web.ts).
 */
// `@expo/metro-runtime` has to come first (expo-router/entry-classic says why). Then the
// requests the web page can start before the rest has run (boot/earlyStart.web.ts).
import '@expo/metro-runtime';
import './boot/earlyStart';
import './app/_layout';
import './app/(tabs)/_layout';
import './app/(tabs)/index';
// With the app's code in, Today's sessions can be asked for the moment the early `me` is in.
import './boot/earlyToday';
import 'expo-router/entry';
