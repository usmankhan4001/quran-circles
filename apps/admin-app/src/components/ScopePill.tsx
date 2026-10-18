import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, ListItem, Sheet, Text, minTouchTarget, radii, spacing, useTheme } from '@qc/ui';
import { useT } from '../appearance/AppearanceProvider';
import { pickLocalized } from '../lib/localized';
import type { WorkingScope } from '../scope/principal';
import { useWorkingScope } from '../scope/WorkingScopeProvider';
import type { MessageKey } from '../i18n/translate';
import { scopeLabel } from './ScopeSwitcher';

/**
 * D17: the masjid (or city) the person is working in, as a glass pill at the start of the green
 * header. With several roles it opens a sheet to switch; with one it is a plain label, so a venue
 * coordinator is never offered a choice that does not exist.
 */
export function ScopePill() {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { scopes, active, setActive } = useWorkingScope();
  const [open, setOpen] = useState(false);
  if (!active) return null;
  const several = scopes.length > 1;
  const short = (s: WorkingScope) =>
    pickLocalized(s.name, locale) || t(`admin.scope.role.${s.role}` as MessageKey);
  const full = `${t('admin.scope.workingAs')}: ${scopeLabel(active, t, locale)}`;
  const body = (
    <>
      <Icon
        name={active.role === 'venue_coordinator' ? 'mosque' : 'map-pin'}
        weight="fill"
        size={16}
        color={colors.textOnHero}
      />
      <View style={{ flexShrink: 1 }}>
        <Text variant="label" color="textOnHero" numberOfLines={1} decorative={several}>
          {short(active)}
        </Text>
      </View>
      {several ? (
        <Icon name="caret-down" weight="bold" size={11} color={colors.textOnHero} />
      ) : null}
    </>
  );
  const look = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    flexShrink: 1,
    minHeight: minTouchTarget - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  };
  if (!several) {
    return (
      <View
        testID="scope-single"
        aria-label={full}
        style={[look, { backgroundColor: colors.heroGlass }]}
      >
        {body}
      </View>
    );
  }
  return (
    <>
      <Pressable
        testID="scope-switcher"
        role="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        accessibilityLabel={full}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          look,
          {
            minHeight: minTouchTarget,
            backgroundColor: pressed ? colors.heroGlassPressed : colors.heroGlass,
          },
        ]}
      >
        {body}
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('admin.scope.workingAs')}
        testID="scope-switcher-sheet"
      >
        <View role="radiogroup" aria-label={t('admin.scope.workingAs')}>
          {scopes.map((s) => {
            const chosen = s.id === active.id;
            return (
              <ListItem
                key={s.id}
                testID={`scope-switcher-option-${s.id}`}
                title={scopeLabel(s, t, locale)}
                chevron={false}
                role="radio"
                checked={chosen}
                selected={chosen}
                accessibilityLabel={scopeLabel(s, t, locale)}
                trailing={
                  chosen ? <Icon name="check" size={20} color={colors.textAccent} /> : undefined
                }
                onPress={() => {
                  setActive(s.id);
                  setOpen(false);
                }}
              />
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
