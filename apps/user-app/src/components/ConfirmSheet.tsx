import { StyleSheet, View } from 'react-native';
import { Button, Sheet, Text, spacing } from '@qc/ui';

const styles = StyleSheet.create({ stack: { gap: spacing.lg }, actions: { gap: spacing.sm } });

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Use for steps that cannot be undone, such as deleting the account. */
  destructive?: boolean;
  busy?: boolean;
  errorText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/** A plain two-button question in a sheet. The safe choice is the first, full-width button. */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive,
  busy,
  errorText,
  onConfirm,
  onCancel,
  testID,
}: ConfirmSheetProps) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} testID={testID}>
      <View style={styles.stack}>
        <Text variant="body">{body}</Text>
        {errorText ? (
          <View role="alert">
            <Text variant="body" color="textDanger" strong>
              {errorText}
            </Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button
            label={cancelLabel}
            size="large"
            fullWidth
            onPress={onCancel}
            testID="confirm-cancel"
          />
          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'secondary'}
            fullWidth
            loading={busy}
            onPress={onConfirm}
            testID="confirm-ok"
          />
        </View>
      </View>
    </Sheet>
  );
}
