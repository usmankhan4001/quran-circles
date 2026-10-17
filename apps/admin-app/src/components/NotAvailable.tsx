import { Card, Text } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';

/**
 * Shown when the server answers `not_found` for a record the person tried to open. The server
 * says `not_found` both for a record that is gone and for one outside the person's scope, so the
 * wording does not say which.
 */
export function NotAvailable({ testID }: { testID?: string }) {
  const { t } = useT();
  return (
    <Card variant="flat" testID={testID ?? 'not-available'}>
      <Text>{t('admin.common.notAvailable')}</Text>
    </Card>
  );
}
