import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, formatNumber, isolate, spacing } from '@qc/ui';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useI18n } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/translate';
import { useNav } from '../../nav/NavProvider';
import { readEnv } from '../../platform/env';
import { useServices } from '../../providers/services';
import { PAGE_LINKS, type PublicBlock, type PublicPageSpec } from './pages';

const styles = StyleSheet.create({
  page: { gap: spacing.xl },
  section: { gap: spacing.md },
  list: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  marker: { minWidth: spacing.lg },
  grow: { flex: 1 },
  faq: { gap: spacing.xs },
  actions: { alignSelf: 'flex-start' },
  links: { gap: spacing.xs },
});

/** The address people write to, or null while it has not been set (`EXPO_PUBLIC_CONTACT_EMAIL`). */
function useContactEmail(): string | null {
  return readEnv().contactEmail || null;
}

export function Bullet({ marker, children }: { marker: string; children: ReactNode }) {
  return (
    <View style={styles.item}>
      <View style={styles.marker}>
        <Text variant="body" color="textSecondary" decorative>
          {marker}
        </Text>
      </View>
      <View style={styles.grow}>{children}</View>
    </View>
  );
}

/** The contact address as a sentence, with a button that opens the mail app once it is set. */
export function ContactBlock({ testID }: { testID?: string }) {
  const { t } = useI18n();
  const { openUrl } = useServices();
  const email = useContactEmail();
  return (
    <View style={styles.section} testID={testID ?? 'contact-block'}>
      <Text variant="body" selectable testID="contact-text">
        {t('legal.contact.body', { email: email ? isolate(email) : t('legal.contact.missing') })}
      </Text>
      {email ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={t('legal.contact.write')}
            onPress={() => void openUrl(`mailto:${email}`)}
            testID="contact-mail"
          />
        </View>
      ) : null}
    </View>
  );
}

function Block({ block }: { block: PublicBlock }) {
  const { t, locale } = useI18n();
  switch (block.kind) {
    case 'p':
      return (
        <Text variant="body" selectable>
          {t(block.key)}
        </Text>
      );
    case 'list':
      return (
        <View style={styles.list} accessibilityRole="list">
          {block.keys.map((key) => (
            <Bullet key={key} marker="•">
              <Text variant="body" selectable>
                {t(key)}
              </Text>
            </Bullet>
          ))}
        </View>
      );
    case 'steps':
      return (
        <View style={styles.list} accessibilityRole="list">
          {block.keys.map((key, index) => (
            <Bullet key={key} marker={`${formatNumber(index + 1, locale)}.`}>
              <Text variant="body" selectable>
                {t(key)}
              </Text>
            </Bullet>
          ))}
        </View>
      );
    case 'faq':
      return (
        <View style={styles.list}>
          {block.items.map((item) => (
            <View key={item.q} style={styles.faq}>
              <Text variant="bodyLarge" strong heading={3}>
                {t(item.q)}
              </Text>
              <Text variant="body" color="textSecondary" selectable>
                {t(item.a)}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'contact':
      return <ContactBlock />;
  }
}

/** Links to the other public pages, at the foot of each. */
export function PageLinks({ current }: { current: string }) {
  const { t } = useI18n();
  const nav = useNav();
  return (
    <View style={styles.section} testID="page-links">
      <Text variant="title3" heading={2}>
        {t('legal.links.heading')}
      </Text>
      <View style={styles.links}>
        {PAGE_LINKS.filter((link) => link.id !== current).map((link) => (
          <View key={link.id} style={styles.actions}>
            <Button
              variant="tertiary"
              label={t(link.label)}
              onPress={() => nav.go(link.route)}
              testID={`link-${link.id}`}
            />
          </View>
        ))}
        <View style={styles.actions}>
          <Button
            variant="tertiary"
            label={t('legal.links.open')}
            onPress={() => nav.go({ name: 'home' })}
            testID="link-home"
          />
        </View>
      </View>
    </View>
  );
}

/** One of the public text pages: a title, an intro, sections of plain blocks, and the links. */
export function PublicPage({ spec }: { spec: PublicPageSpec }) {
  const { t } = useI18n();
  const nav = useNav();
  return (
    <ScreenFrame title={t(spec.title)} onBack={() => nav.back()} plain testID={`public-${spec.id}`}>
      <View style={styles.page}>
        <View style={styles.section}>
          <Text variant="bodyLarge" selectable>
            {t(spec.intro as TranslationKey)}
          </Text>
          {spec.dated ? (
            <Text variant="caption" color="textSecondary" testID="legal-updated">
              {t('legal.updated', { date: t('legal.dateValue') })}
            </Text>
          ) : null}
        </View>
        {spec.sections.map((section) => (
          <View key={section.id} style={styles.section} testID={`section-${section.id}`}>
            <Text variant="title3" heading={2}>
              {t(section.heading)}
            </Text>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </View>
        ))}
        <PageLinks current={spec.id} />
      </View>
    </ScreenFrame>
  );
}
