import { useState, type ReactNode } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import {
  Button,
  Chip,
  SegmentedControl,
  Sheet,
  Switch,
  Text,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import { ARABIC_ZOOM_STEPS, type ReaderPrefs } from '../quran/prefs';
import { useContentI18n, type ContentI18n } from './i18n';

export interface ReaderSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  prefs: ReaderPrefs;
  onChange: (patch: Partial<ReaderPrefs>) => void;
  /** What the reader shows under "Auto": the look of the app right now. */
  autoLook: 'light' | 'night';
}

/**
 * The reading settings: Arabic text size, the translation (shown or not, and which), ayah by
 * ayah or the Mushaf page, the script, and a light or night look for the reader. Every choice is
 * saved at once and shown behind the sheet.
 */
export function ReaderSettingsSheet({
  visible,
  onClose,
  prefs,
  onChange,
  autoLook,
}: ReaderSettingsSheetProps) {
  const i18n = useContentI18n();
  const look = prefs.theme === 'auto' ? autoLook : prefs.theme;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={i18n.t('quran.reader.settings')}
      testID="settings-sheet"
    >
      <View style={{ gap: spacing.lg }}>
        <Group label={i18n.t('quran.textSize')}>
          <SizeSlider
            index={prefs.arabicZoomIndex}
            onChange={(arabicZoomIndex) => onChange({ arabicZoomIndex })}
            i18n={i18n}
          />
        </Group>

        <View style={{ gap: spacing.sm }}>
          <Switch
            label={i18n.t('quran.reader.showTranslation')}
            value={prefs.showTranslation}
            onValueChange={(showTranslation) => onChange({ showTranslation })}
            testID="translation-switch"
          />
          {prefs.showTranslation ? (
            <View
              role="radiogroup"
              aria-label={i18n.t('quran.reader.translator')}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
            >
              {/* One translation is built in (Maududi's, in both languages). Others need a
                  rights decision and a source (docs/agents/status/ui.md). */}
              <Chip
                label={i18n.t('quran.translator.maududi')}
                selected
                testID="translator-maududi"
              />
            </View>
          ) : null}
          {prefs.showTranslation ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: minTouchTarget,
              }}
              testID="reader-more-translators"
            >
              <Text color="textMuted">{i18n.t('quran.reader.moreTranslators')}</Text>
              <SoonTag label={i18n.t('quran.reader.soon')} />
            </View>
          ) : null}
        </View>

        <Group label={i18n.t('quran.reader.layout')}>
          <SegmentedControl
            accessibilityLabel={i18n.t('quran.reader.layout')}
            value={prefs.layout}
            onChange={(layout) => onChange({ layout })}
            options={[
              { value: 'ayah', label: i18n.t('quran.reader.layout.ayah') },
              { value: 'mushaf', label: i18n.t('quran.reader.layout.mushaf') },
            ]}
            testID="layout-switch"
          />
        </Group>

        <Group label={i18n.t('quran.reader.script')}>
          <SegmentedControl
            accessibilityLabel={i18n.t('quran.reader.script')}
            value={prefs.script}
            onChange={(script) => onChange({ script })}
            options={[
              { value: 'indopak', label: i18n.t('quran.reader.script.indopak'), disabled: true },
              { value: 'uthmani', label: i18n.t('quran.reader.script.uthmani') },
            ]}
            testID="script-switch"
          />
        </Group>

        <Group label={i18n.t('quran.reader.theme')}>
          <SegmentedControl
            accessibilityLabel={i18n.t('quran.reader.theme')}
            value={look}
            onChange={(theme) => onChange({ theme })}
            options={[
              { value: 'light', label: i18n.t('quran.reader.theme.light') },
              { value: 'night', label: i18n.t('quran.reader.theme.night') },
            ]}
            testID="theme-switch"
          />
        </Group>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: minTouchTarget,
          }}
          testID="reader-reciter"
        >
          <Text>{i18n.t('quran.reader.reciterLabel')}</Text>
          <SoonTag label={i18n.t('quran.reader.soon')} />
        </View>

        <Button
          size="large"
          fullWidth
          label={i18n.t('quran.reader.done')}
          onPress={onClose}
          testID="settings-done"
        />
      </View>
    </Sheet>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="eyebrow" color="textMuted">
        {label}
      </Text>
      {children}
    </View>
  );
}

function SoonTag({ label }: { label: string }) {
  const c = useTheme().colors;
  return (
    <View
      style={{
        backgroundColor: c.surfaceMuted,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

/**
 * The Arabic size: a small and a large Arabic letter at the ends (each steps one size), and a
 * track between them. A tap on the track picks the nearest size. A screen reader gets a slider.
 */
function SizeSlider({
  index,
  onChange,
  i18n,
}: {
  index: number;
  onChange: (index: number) => void;
  i18n: ContentI18n;
}) {
  const c = useTheme().colors;
  const last = ARABIC_ZOOM_STEPS.length - 1;
  const [width, setWidth] = useState(0);
  // The track always runs from the small letter to the large one, whatever the direction.
  const fraction = index / last;
  const knob = 24;
  const pick = (x: number) => {
    if (width <= 0) return;
    onChange(Math.round(Math.min(1, Math.max(0, x / width)) * last));
  };
  const end = (glyphSize: number, label: string, next: number, off: boolean, testID: string) => (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={off}
      disabled={off}
      onPress={() => onChange(next)}
      testID={testID}
      style={{
        width: minTouchTarget,
        height: minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.45 : 1,
      }}
    >
      <Text
        variant="quran"
        lang="ar"
        color="textMuted"
        decorative
        style={{ fontSize: glyphSize, lineHeight: glyphSize + 8 }}
      >
        {'ع'}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', direction: 'ltr' }}>
      {end(18, i18n.t('quran.reader.smaller'), index - 1, index <= 0, 'zoom-smaller')}
      <View
        role="slider"
        aria-label={i18n.t('quran.textSize')}
        aria-valuemin={1}
        aria-valuemax={ARABIC_ZOOM_STEPS.length}
        aria-valuenow={index + 1}
        aria-valuetext={i18n.t('quran.reader.sizeValue', {
          step: i18n.n(index + 1),
          total: i18n.n(ARABIC_ZOOM_STEPS.length),
        })}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(event) => pick(event.nativeEvent.locationX)}
        testID="zoom-track"
        style={{ flex: 1, height: minTouchTarget, justifyContent: 'center' }}
      >
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surfaceMuted }}>
          <View
            style={{
              width: `${fraction * 100}%`,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.accent,
            }}
          />
        </View>
        <View
          aria-hidden
          style={{
            position: 'absolute',
            left: Math.max(0, width * fraction - knob / 2),
            width: knob,
            height: knob,
            borderRadius: knob / 2,
            backgroundColor: c.surface,
            borderWidth: 2,
            borderColor: c.accent,
          }}
        />
      </View>
      {end(30, i18n.t('quran.reader.larger'), index + 1, index >= last, 'zoom-larger')}
    </View>
  );
}
