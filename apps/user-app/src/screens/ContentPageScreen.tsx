import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Text, spacing, useTheme } from '@qc/ui';
import { Page } from '../components/Page';
import { QueryBoundary } from '../components/QueryBoundary';
import { useQuery } from '../data/useQuery';
import { parseHelpBody, type FaqItem } from '../features/content/faq';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  paragraphs: { gap: spacing.md },
  items: { gap: spacing.md },
  ask: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  question: { flex: 1 },
  answer: { gap: spacing.sm, paddingTop: spacing.sm },
});

/** One question that opens to its answer. The first two start open, as drawn. */
function Faq({
  item,
  startOpen,
  index,
  lang,
}: {
  item: FaqItem;
  startOpen: boolean;
  index: number;
  lang: 'en' | 'ur';
}) {
  const c = useTheme().colors;
  const [open, setOpen] = useState(startOpen);
  return (
    <Card padding="lg" testID={`faq-${index}`}>
      <Pressable
        role="button"
        aria-expanded={open}
        aria-label={item.question}
        onPress={() => setOpen((v) => !v)}
        testID={`faq-${index}-toggle`}
        style={styles.ask}
      >
        <View style={styles.question}>
          <Text variant="title3" lang={lang} decorative>
            {item.question}
          </Text>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.answer}>
          {item.answer.map((p, i) => (
            <Text key={i} variant="body" color="textSecondary" lang={lang} selectable>
              {p}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** An About, FAQ or help page edited in the console, in the person's language. */
export function ContentPageScreen({ slug }: { slug: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { api } = useServices();
  const page = useQuery(`content:${slug}`, () => api.content.page({ params: { slug } }), {
    persist: true,
    staleMs: 10 * 60_000,
  });
  return (
    <Page
      barTitle={page.data ? l(page.data.title).text : t('ui.loading')}
      onBack={() => nav.back()}
      testID="content-page-screen"
    >
      <QueryBoundary query={page}>
        {(p) => {
          const body = l(p.body);
          const parsed = parseHelpBody(body.text);
          const updated = new Intl.DateTimeFormat(locale === 'ur' ? 'ur-PK' : 'en-GB', {
            day: 'numeric',
            month: 'short',
          }).format(new Date(p.publishedAt));
          return (
            <View style={styles.stack}>
              {parsed.intro.length > 0 ? (
                <View style={styles.paragraphs}>
                  {parsed.intro.map((para, i) => (
                    <Text key={i} variant="bodyLarge" lang={body.lang} selectable>
                      {para}
                    </Text>
                  ))}
                </View>
              ) : null}
              {parsed.items.length > 0 ? (
                <View style={styles.items} testID="content-faq">
                  {parsed.items.map((item, i) => (
                    <Faq key={i} item={item} startOpen={i < 2} index={i} lang={body.lang} />
                  ))}
                </View>
              ) : null}
              <Text variant="caption" color="textMuted" testID="content-updated">
                {t('content.updated', { date: updated })}
              </Text>
            </View>
          );
        }}
      </QueryBoundary>
    </Page>
  );
}
