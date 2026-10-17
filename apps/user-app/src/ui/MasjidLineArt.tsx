import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@qc/ui';

export interface MasjidLineArtProps {
  /** Height in dp; the drawing is about twice as wide. */
  height?: number;
  testID?: string;
}

const s = StyleSheet.create({
  box: { alignSelf: 'center', position: 'relative' },
  abs: { position: 'absolute' },
});

/**
 * The line drawing of a masjid on the sign-in header (A): a dome with its crescent post, two
 * minarets and an arched door, drawn as light outlines on the green. Decoration only.
 */
export function MasjidLineArt({ height: h = 120, testID }: MasjidLineArtProps) {
  const c = useTheme().colors;
  const line = Math.max(2, Math.round(h / 50));
  const ink = c.heroGlassPressed;
  const w = h * 2;
  const outline: ViewStyle = { borderWidth: line, borderColor: ink };
  const hallW = h * 0.9;
  const hallH = h * 0.42;
  const domeW = h * 0.62;
  const domeH = h * 0.36;
  const minW = h * 0.12;
  const minH = h * 0.78;
  const center = (width: number) => (w - width) / 2;
  return (
    <View aria-hidden testID={testID} style={[s.box, { width: w, height: h }]}>
      {/* ground */}
      <View
        style={[s.abs, { bottom: 0, start: 0, width: w, height: line, backgroundColor: ink }]}
      />
      {/* minarets with their caps */}
      {[center(hallW) - minW * 1.6, center(hallW) + hallW + minW * 0.6].map((start, i) => (
        <View key={i}>
          <View style={[s.abs, outline, { bottom: 0, start, width: minW, height: minH }]} />
          <View
            style={[
              s.abs,
              outline,
              {
                bottom: minH - line,
                start: start - line,
                width: minW + line * 2,
                height: minW,
                borderTopLeftRadius: minW,
                borderTopRightRadius: minW,
              },
            ]}
          />
        </View>
      ))}
      {/* hall */}
      <View
        style={[s.abs, outline, { bottom: 0, start: center(hallW), width: hallW, height: hallH }]}
      />
      {/* dome */}
      <View
        style={[
          s.abs,
          outline,
          {
            bottom: hallH - line,
            start: center(domeW),
            width: domeW,
            height: domeH,
            borderTopLeftRadius: domeW / 2,
            borderTopRightRadius: domeW / 2,
            borderBottomWidth: 0,
          },
        ]}
      />
      {/* post and crescent */}
      <View
        style={[
          s.abs,
          {
            bottom: hallH + domeH - line,
            start: center(line),
            width: line,
            height: h * 0.1,
            backgroundColor: ink,
          },
        ]}
      />
      <View
        style={[
          s.abs,
          outline,
          {
            bottom: hallH + domeH + h * 0.09,
            start: center(h * 0.08),
            width: h * 0.08,
            height: h * 0.08,
            borderRadius: h,
          },
        ]}
      />
      {/* arched door */}
      <View
        style={[
          s.abs,
          outline,
          {
            bottom: 0,
            start: center(h * 0.2),
            width: h * 0.2,
            height: h * 0.28,
            borderTopLeftRadius: h * 0.1,
            borderTopRightRadius: h * 0.1,
            borderBottomWidth: 0,
          },
        ]}
      />
    </View>
  );
}
