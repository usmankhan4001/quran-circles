import { EmptyState } from '@qc/ui';
import { ProfileButton } from '../components/ProfileButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { useI18n } from '../i18n/I18nProvider';
import type { ReaderRequest } from '../features/content/modules';
import { useServices } from '../providers/services';

/**
 * The Quran & Prayer tab. The reader and prayer times come from `@qc/content`; this screen
 * only mounts them under the app's header (which carries the profile button). Without the
 * package it says so plainly.
 */
export function QuranPrayerScreen({ reader }: { reader?: ReaderRequest }) {
  const { t } = useI18n();
  const { content } = useServices();
  const Module = content.QuranPrayerScreen;
  if (Module) {
    return (
      <ScreenFrame
        title={t('tabs.quranPrayer')}
        actions={<ProfileButton />}
        scroll={false}
        testID="quran-screen"
      >
        <Module {...(reader ? { reader } : {})} />
      </ScreenFrame>
    );
  }
  return (
    <ScreenFrame
      title={t('tabs.quranPrayer')}
      variant="large"
      actions={<ProfileButton />}
      testID="quran-screen"
    >
      <EmptyState
        icon="info"
        title={t('quran.unavailable.title')}
        description={t('quran.unavailable.body')}
        testID="quran-unavailable"
      />
    </ScreenFrame>
  );
}
