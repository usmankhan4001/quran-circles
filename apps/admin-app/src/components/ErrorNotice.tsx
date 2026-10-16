import { Toast } from '@qc/ui';
import { errorMessageKey } from '../api/errors';
import { useT } from '../appearance/AppearanceProvider';

/** The message for a failed write, kept on screen until the person dismisses it. */
export function ErrorNotice({
  error,
  onDismiss,
  testID,
}: {
  error: unknown;
  onDismiss?: () => void;
  testID?: string;
}) {
  const { t } = useT();
  if (!error) return null;
  return (
    <Toast
      testID={testID ?? 'error-notice'}
      kind="danger"
      durationMs={0}
      message={t(errorMessageKey(error))}
      onDismiss={onDismiss}
      dismissLabel={t('ui.dismiss')}
    />
  );
}
