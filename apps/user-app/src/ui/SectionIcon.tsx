import { StyleSheet, View } from 'react-native';
import type { Section } from '@qc/contracts';
import { keepColorsInForcedMode, systemColors, useForcedColors } from '@qc/ui';

export interface SectionIconProps {
  section: Section;
  size?: number;
  color: string;
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  figure: { alignItems: 'center' },
});

/** One person: a head over a body. A woman's body is a gown, wider at the hem. */
function Figure({ unit, color, gown }: { unit: number; color: string; gown: boolean }) {
  const head = unit * 0.42;
  const bodyW = unit * 0.7;
  const bodyH = unit * 0.62;
  return (
    <View style={s.figure}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head,
          backgroundColor: color,
          marginBottom: unit * 0.06,
        }}
      />
      {gown ? (
        <View
          style={{
            width: bodyW,
            height: 0,
            borderBottomWidth: bodyH,
            borderBottomColor: color,
            borderLeftWidth: bodyW * 0.18,
            borderRightWidth: bodyW * 0.18,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopLeftRadius: bodyW / 2,
            borderTopRightRadius: bodyW / 2,
          }}
        />
      ) : (
        <View
          style={{
            width: bodyW,
            height: bodyH,
            borderTopLeftRadius: bodyW / 2,
            borderTopRightRadius: bodyW / 2,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}

/**
 * The picture of a section (R2, H4): a woman, a man, or a family of two grown-ups and a child,
 * drawn with views like the kit's icons. Decoration: the section's name is always next to it.
 * TODO(kit): replace with @qc/ui section icons when the ui lane adds them.
 */
export function SectionIcon({ section, size = 24, color: themed }: SectionIconProps) {
  // Drawn from backgrounds, which forced colours (web) repaint as the page: keep the drawing
  // and use the system text colour, as the kit's Icon does (A-07).
  const forced = useForcedColors();
  const color = forced ? systemColors.text : themed;
  const box = [{ width: size, height: size }, forced ? keepColorsInForcedMode : null];
  if (section === 'family') {
    return (
      <View aria-hidden style={[s.box, ...box, { gap: size * 0.04 }]}>
        <Figure unit={size * 0.5} color={color} gown={false} />
        <Figure unit={size * 0.34} color={color} gown={false} />
        <Figure unit={size * 0.5} color={color} gown />
      </View>
    );
  }
  return (
    <View aria-hidden style={[s.box, ...box]}>
      <Figure unit={size * 0.9} color={color} gown={section === 'women'} />
    </View>
  );
}
