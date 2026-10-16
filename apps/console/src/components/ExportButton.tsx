import { useState } from 'react';
import { useSignedIn } from '../api/auth';
import { Banner, Button } from './ui';
import { useI18n } from '../i18n';
import { errorMessageKeyOf } from '../lib/errors';
import { saveTextFile, todayStamp } from '../lib/download';

/**
 * Downloads one session's registrants as CSV. The API checks the scope and writes the audit row
 * for every export; the console only shows the result and never keeps the file's contents.
 */
export function SessionExportButton({
  sessionId,
  disabled = false,
}: {
  sessionId: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const { api } = useSignedIn();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const run = async () => {
    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      const csv = await api.registrations.export({ params: { sessionId } });
      saveTextFile(`registrations-${todayStamp()}.csv`, csv);
      setSaved(true);
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-action">
      <Button variant="primary" busy={busy} disabled={disabled} onClick={() => void run()}>
        {busy ? t('console.exports.exporting') : t('console.exports.button')}
      </Button>
      {failure ? (
        <Banner tone="danger" title={t('console.exports.failed')}>
          {t(errorMessageKeyOf(failure))}
        </Banner>
      ) : null}
      {saved ? <Banner tone="success">{t('console.exports.saved')}</Banner> : null}
    </div>
  );
}
