import { View } from 'react-native';
import { Card, Select, Text, spacing } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';
import type { MessageKey, Translator } from '../i18n/translate';
import { pickLocalized } from '../lib/localized';
import type { WorkingScope } from '../scope/principal';
import { useWorkingScope } from '../scope/WorkingScopeProvider';
import type { Locale } from '@qc/contracts';

export function scopeLabel(scope: WorkingScope, t: Translator, locale: Locale): string {
  const role = t(`admin.scope.role.${scope.role}` as MessageKey);
  const name = pickLocalized(scope.name, locale);
  return name ? `${role} · ${name}` : role;
}

/**
 * Shows who the person is working as. With several roles it is a picker; with one it is a
 * plain line, so a venue coordinator is never offered a choice that does not exist.
 */
export function ScopeSwitcher() {
  const { t, locale } = useT();
  const { scopes, active, setActive } = useWorkingScope();
  if (!active) return null;
  if (scopes.length <= 1) {
    return (
      <Card variant="flat" testID="scope-single">
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="textSecondary">
            {t('admin.scope.workingAs')}
          </Text>
          <Text variant="label">{scopeLabel(active, t, locale)}</Text>
        </View>
      </Card>
    );
  }
  return (
    <Select
      testID="scope-switcher"
      label={t('admin.scope.workingAs')}
      required
      value={active.id}
      onChange={setActive}
      options={scopes.map((s) => ({ value: s.id, label: scopeLabel(s, t, locale) }))}
    />
  );
}
