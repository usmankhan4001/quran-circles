import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Sheet, spacing } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  danger?: boolean;
  children: ReactNode;
  testID?: string;
}

/** Asks "are you sure" with the consequences spelled out above the buttons. */
export function ConfirmSheet({
  visible,
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  danger,
  children,
  testID,
}: ConfirmSheetProps) {
  const { t } = useT();
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} testID={testID}>
      <View style={{ gap: spacing.lg }}>
        {children}
        <Button
          testID={testID ? `${testID}-confirm` : 'confirm'}
          label={confirmLabel}
          variant={danger ? 'danger' : 'primary'}
          size="large"
          fullWidth
          loading={busy}
          onPress={onConfirm}
        />
        <Button
          testID={testID ? `${testID}-cancel` : 'cancel'}
          label={t('admin.common.cancel')}
          variant="tertiary"
          fullWidth
          disabled={busy}
          onPress={onCancel}
        />
      </View>
    </Sheet>
  );
}
