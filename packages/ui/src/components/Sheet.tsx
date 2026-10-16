import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { elevation, radii, spacing } from '../tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Defaults to the kit's "Close" in the current language. */
  closeLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    borderTopStartRadius: radii.xl,
    borderTopEndRadius: radii.xl,
    paddingBottom: spacing.xl,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: spacing.lg,
    paddingEnd: spacing.xs,
    paddingTop: spacing.xs,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});

/**
 * A bottom sheet. On web it is a dialog with a dimmed backdrop. Pressing the backdrop, the
 * close button or the system back action closes it.
 */
export function Sheet({ visible, onClose, title, children, closeLabel, testID }: SheetProps) {
  const theme = useTheme();
  const c = theme.colors;
  // Modal content is a separate tree on native, so the direction is set again inside it.
  const webDir = { dir: theme.direction };
  return (
    <Modal
      visible={visible}
      transparent
      animationType={theme.reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View {...webDir} style={[styles.fill, { direction: theme.direction, backgroundColor: c.scrim }]}>
        <Pressable
          testID={testID ? `${testID}-backdrop` : 'sheet-backdrop'}
          aria-hidden
          focusable={false}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          testID={testID}
          role="dialog"
          aria-modal
          aria-label={title}
          style={[
            styles.sheet,
            { backgroundColor: c.surfaceRaised, boxShadow: elevation.high },
            theme.mode === 'highContrast' ? { borderTopWidth: 2, borderColor: c.borderStrong } : undefined,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.borderStrong }]} aria-hidden />
          <View style={styles.header}>
            <View style={styles.title}>
              <Text variant="title3" heading={2}>
                {title}
              </Text>
            </View>
            <IconButton icon="close" accessibilityLabel={closeLabel ?? theme.t('ui.close')} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}
