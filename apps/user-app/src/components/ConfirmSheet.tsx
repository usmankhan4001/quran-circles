import { ConfirmSheet as KitConfirmSheet } from '@qc/ui';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Use for steps that cannot be undone, such as deleting the account. */
  destructive?: boolean;
  busy?: boolean;
  /** Why the step failed. It shows under the question so the person can try again. */
  errorText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

/**
 * A plain two-button question in the kit's green-topped sheet (D13). The kit sheet has no slot
 * for a failure, so the reason is added to the question. The buttons are `${testID}-confirm`
 * and `${testID}-cancel`.
 */
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
    <KitConfirmSheet
      visible={visible}
      title={title}
      message={errorText ? `${body}\n\n${errorText}` : body}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      destructive={destructive}
      busy={busy}
      testID={testID}
    />
  );
}
