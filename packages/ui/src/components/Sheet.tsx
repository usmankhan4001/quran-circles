import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
    borderTopStartRadius: radii.sheet,
    borderTopEndRadius: radii.sheet,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  top: { paddingBottom: spacing.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: spacing.lg,
    paddingEnd: spacing.xs,
    paddingTop: spacing.sm,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg },
});

/**
 * The visible panel of a sheet, without the modal around it. `Sheet` uses it; the catalog uses
 * it to show a sheet that is open.
 */
export function SheetPanel({
  title,
  children,
  onClose,
  closeLabel,
  testID,
  inModal,
}: Omit<SheetProps, 'visible'> & { inModal?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      testID={testID}
      // On the web the Modal itself is the named dialog, so the panel must not be a second one.
      role={inModal && Platform.OS === 'web' ? undefined : 'dialog'}
      aria-modal={inModal && Platform.OS === 'web' ? undefined : true}
      aria-label={inModal && Platform.OS === 'web' ? undefined : title}
      style={[
        styles.sheet,
        { backgroundColor: c.surfaceRaised, boxShadow: elevation.high },
        theme.mode === 'highContrast'
          ? { borderTopWidth: 2, borderColor: c.borderStrong }
          : undefined,
      ]}
    >
      {/* D17: a clean white sheet with a grab handle, the title and a round close button. */}
      <View style={styles.top}>
        <View style={[styles.handle, { backgroundColor: c.border }]} aria-hidden />
        <View style={styles.header}>
          <View style={styles.title}>
            <Text variant="title3" heading={2}>
              {title}
            </Text>
          </View>
          <IconButton
            icon="close"
            variant="tonal"
            accessibilityLabel={closeLabel ?? theme.t('ui.close')}
            onPress={onClose}
          />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
    </View>
  );
}

/**
 * A bottom sheet. On web it is a dialog with a dimmed backdrop. Pressing the backdrop, the
 * close button or the system back action closes it.
 */
export function Sheet({ visible, onClose, title, children, closeLabel, testID }: SheetProps) {
  const theme = useTheme();
  // Modal content is a separate tree on native, so the direction is set again inside it.
  const webDir = { dir: theme.direction };
  // Props the native typings do not list; the web target passes them to the dialog element.
  const webDialog = { 'aria-label': title };
  return (
    <Modal
      {...webDialog}
      visible={visible}
      transparent
      animationType={theme.reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View
        {...webDir}
        style={[styles.fill, { direction: theme.direction, backgroundColor: theme.colors.scrim }]}
      >
        <Pressable
          testID={testID ? `${testID}-backdrop` : 'sheet-backdrop'}
          aria-hidden
          focusable={false}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SheetPanel title={title} onClose={onClose} closeLabel={closeLabel} testID={testID} inModal>
          {children}
        </SheetPanel>
      </View>
    </Modal>
  );
}
