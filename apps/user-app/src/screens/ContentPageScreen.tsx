import { View } from 'react-native';
import { Text } from '@qc/ui';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { useQuery } from '../data/useQuery';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

/** An About, FAQ or help page edited in the console, in the person's language. */
export function ContentPageScreen({ slug }: { slug: string }) {
  const { t, l } = useI18n();
  const nav = useNav();
  const { api } = useServices();
  const page = useQuery(`content:${slug}`, () => api.content.page({ params: { slug } }), {
    persist: true,
    staleMs: 10 * 60_000,
  });
  return (
    <ScreenFrame
      title={page.data ? l(page.data.title).text : t('ui.loading')}
      onBack={() => nav.back()}
      testID="content-page-screen"
    >
      <QueryBoundary query={page}>
        {(p) => {
          const body = l(p.body);
          return (
            <View>
              <Text variant="bodyLarge" lang={body.lang} selectable>
                {body.text}
              </Text>
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenFrame>
  );
}
