import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text, spacing } from '@qc/ui';
import type { V1ImportStatus } from '../bookmarks/v1Import';
import { useContent } from './context';
import { useContentI18n } from './i18n';

type Phase =
  | { name: 'hidden' }
  | { name: 'offer'; bookmarks: number; hasLastRead: boolean; failed: boolean }
  | { name: 'working' }
  | { name: 'done'; imported: number };

/**
 * Offers the one-time import of bookmarks saved by the old browser app. It shows only when the
 * browser has V1 data, nobody has answered yet, and the person is signed in.
 */
export function V1ImportBanner({ testID }: { testID?: string }) {
  const { services, signedIn } = useContent();
  const i18n = useContentI18n();
  const importer = services.importer;
  const [phase, setPhase] = useState<Phase>({ name: 'hidden' });

  useEffect(() => {
    if (!importer) return;
    let active = true;
    void importer.status().then((status: V1ImportStatus) => {
      if (!active) return;
      setPhase(
        status.state === 'available'
          ? {
              name: 'offer',
              bookmarks: status.bookmarks,
              hasLastRead: status.hasLastRead,
              failed: false,
            }
          : { name: 'hidden' },
      );
    });
    return () => {
      active = false;
    };
  }, [importer, signedIn]);

  const run = useCallback(async () => {
    if (!importer) return;
    const before = phase;
    setPhase({ name: 'working' });
    const outcome = await importer.run();
    if (outcome.ok) {
      setPhase({ name: 'done', imported: outcome.imported });
    } else if (before.name === 'offer') {
      setPhase({ ...before, failed: true });
    }
  }, [importer, phase]);

  const skip = useCallback(async () => {
    if (!importer) return;
    await importer.skip();
    setPhase({ name: 'hidden' });
  }, [importer]);

  if (phase.name === 'hidden') return null;

  if (phase.name === 'done') {
    return (
      <Card variant="flat" testID={testID}>
        <Text testID="v1-import-done">
          {phase.imported > 0
            ? i18n.tn('quran.import.done', phase.imported)
            : i18n.t('quran.import.title')}
        </Text>
      </Card>
    );
  }

  const working = phase.name === 'working';
  const body =
    phase.name === 'offer' && phase.bookmarks > 0
      ? i18n.tn('quran.import.body', phase.bookmarks)
      : i18n.t('quran.import.bodyPlace');
  return (
    <Card variant="outlined" testID={testID}>
      <Text variant="title3" heading={2}>
        {i18n.t('quran.import.title')}
      </Text>
      <View style={{ height: spacing.xs }} />
      <Text color="textSecondary">{body}</Text>
      {phase.name === 'offer' && phase.failed ? (
        <>
          <View style={{ height: spacing.sm }} />
          <Text color="textDanger" testID="v1-import-error">
            {i18n.t('quran.import.error')}
          </Text>
        </>
      ) : null}
      <View style={{ height: spacing.md }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button
          label={working ? i18n.t('quran.import.working') : i18n.t('quran.import.action')}
          loading={working}
          onPress={() => void run()}
          testID="v1-import-run"
        />
        <Button
          variant="tertiary"
          label={i18n.t('quran.import.skip')}
          disabled={working}
          onPress={() => void skip()}
          testID="v1-import-skip"
        />
      </View>
    </Card>
  );
}
