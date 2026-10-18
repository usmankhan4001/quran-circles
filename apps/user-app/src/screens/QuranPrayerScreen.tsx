import { EmptyState } from '@qc/ui';
import { ProfileButton } from '../components/ProfileButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { useI18n } from '../i18n/I18nProvider';
import type { ReaderRequest } from '../features/content/modules';
import { useServices } from '../providers/services';

/**
 * The Quran & Prayer tab. The reader and prayer times come from `@qc/content`, and the module
 * draws the whole page as on the showcase (D17): its own green header with the Quran / Waqt
 * switch and the profile button, and a plain top bar in the reader. Without the package this
 * screen says so plainly.
 */
export function QuranPrayerScreen({ reader }: { reader?: ReaderRequest }) {
  const { t } = useI18n();
  const { content } = useServices();
  const Module = content.QuranPrayerScreen;
  if (Module) {
    return <Module {...(reader ? { reader } : {})} />;
  }
  return (
    <ScreenFrame title={t('tabs.quranPrayer')} actions={<ProfileButton />} testID="quran-screen">
      <EmptyState
        icon="info"
        title={t('quran.unavailable.title')}
        description={t('quran.unavailable.body')}
        testID="quran-unavailable"
      />
    </ScreenFrame>
  );
}
