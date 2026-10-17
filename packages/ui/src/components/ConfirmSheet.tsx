import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Button } from './Button';
import { SheetPanel } from './Sheet';
import { Text } from './Text';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** For actions that cannot be undone, such as cancelling a session. */
  destructive?: boolean;
  /** Shows a spinner on the confirm button while the action runs. */
  busy?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
});

/**
 * Asks before an action (D13). The green-topped sheet with the message, then the buttons:
 * for a destructive action the danger button comes first and "keep" is the leaf-tint one;
 * otherwise the main action is solid green.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive,
  busy,
  testID,
}: ConfirmSheetProps) {
  const theme = useTheme();
  const webDialog = { 'aria-label': title };
  return (
    <Modal
      {...webDialog}
      visible={visible}
      transparent
      animationType={theme.reduceMotion ? 'none' : 'slide'}
      onRequestClose={onCancel}
    >
      <View
        {...{ dir: theme.direction }}
        style={[styles.fill, { direction: theme.direction, backgroundColor: theme.colors.scrim }]}
      >
        <Pressable
          aria-hidden
          focusable={false}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <SheetPanel title={title} onClose={onCancel} testID={testID} inModal>
          <Text>{message}</Text>
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={busy}
              fullWidth
              testID={testID ? `${testID}-confirm` : undefined}
            />
            <Button
              label={cancelLabel}
              variant="secondary"
              onPress={onCancel}
              fullWidth
              testID={testID ? `${testID}-cancel` : undefined}
            />
          </View>
        </SheetPanel>
      </View>
    </Modal>
  );
}
