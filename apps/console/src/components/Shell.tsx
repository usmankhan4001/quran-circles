import { NavLink, Outlet } from 'react-router';
import type { Role } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useFeatures } from '../api/features';
import { useI18n, type Locale } from '../i18n';
import { visibleNav, type NavId } from '../lib/permissions';
import { useTheme, type ThemeChoice } from '../theme';
import type { TextSizeStep } from '../lib/ui-tokens';
import { Icon, PatternLayer, type IconName } from './icons';
import { Button, SelectField } from './ui';
import { CreditsFooter } from './Credits';

const ROLE_KEYS = {
  national_admin: 'console.roles.national_admin',
  city_coordinator: 'console.roles.city_coordinator',
  venue_coordinator: 'console.roles.venue_coordinator',
} as const satisfies Record<Role, MessageKey>;

export const roleLabelKey = (role: Role): MessageKey => ROLE_KEYS[role];

/** Settings every console screen needs: language, theme and text size. */
export function DisplayControls() {
  const { t, locale, setLocale } = useI18n();
  const theme = useTheme();
  return (
    <>
      <SelectField
        id="ctl-language"
        label={t('console.shell.language')}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        options={[
          { value: 'en', label: t('console.shell.language.en') },
          { value: 'ur', label: t('console.shell.language.ur') },
        ]}
      />
      <SelectField
        id="ctl-theme"
        label={t('console.shell.theme')}
        value={theme.choice}
        onChange={(e) => theme.setChoice(e.target.value as ThemeChoice)}
        options={[
          { value: 'system', label: t('console.shell.theme.system') },
          { value: 'light', label: t('console.shell.theme.light') },
          { value: 'dark', label: t('console.shell.theme.dark') },
        ]}
      />
      <SelectField
        id="ctl-text-size"
        label={t('console.shell.textSize')}
        value={String(theme.textStep)}
        onChange={(e) => theme.setTextStep(Number(e.target.value) as TextSizeStep)}
        options={[
          { value: '0', label: t('console.shell.textSize.step0') },
          { value: '1', label: t('console.shell.textSize.step1') },
          { value: '2', label: t('console.shell.textSize.step2') },
          { value: '3', label: t('console.shell.textSize.step3') },
        ]}
      />
    </>
  );
}

const NAV_ICONS = {
  sessions: 'halaqa',
  venues: 'masjid',
  exports: 'download',
  coordinators: 'users',
  import: 'upload',
  audit: 'log',
  dailyAyahs: 'book',
  settings: 'gear',
} as const satisfies Record<NavId, IconName>;

/** Up to two initials for the avatar, whatever the script. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('');
}

/**
 * The signed-in frame (C2): a green sidebar with the eight-point pattern holds the brand, the menu
 * with only the pages the person may use, and who is signed in. The light content area has the
 * display settings on top and the page below. The sidebar sits at the start edge, so it moves to
 * the right in Urdu without any separate rules.
 */
export function Shell() {
  const { t, tx } = useI18n();
  const { me, principal, signOut } = useSignedIn();
  const features = useFeatures();
  const items = visibleNav(principal, features.flags);
  const roles = [...new Set(me.roles.map((r) => r.role))];
  const name = me.displayName ?? t('console.shell.unnamed');

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t('console.shell.skipToContent')}
      </a>
      <div className="sidebar">
        <PatternLayer />
        <div className="brand">
          <span className="brand-mark">
            <Icon name="halaqa" />
          </span>
          <span className="brand-text">
            <span className="brand-name">{t('app.name')}</span>
            <span className="brand-sub">{t('console.shell.brandSub')}</span>
          </span>
        </div>
        <nav className="shell-nav" aria-label={t('console.shell.navLabel')}>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <NavLink className="nav-link" to={item.path}>
                  <Icon name={NAV_ICONS[item.id]} />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="shell-user">
          <div className="shell-user-id">
            <span className="avatar" aria-hidden="true">
              {initialsOf(name)}
            </span>
            <div className="shell-user-text">
              <div className="shell-user-name">{name}</div>
              <div className="shell-user-role">{roles.map((r) => tx(ROLE_KEYS[r])).join(', ')}</div>
            </div>
          </div>
          <Button variant="onHero" onClick={() => void signOut()}>
            {t('console.shell.signOut')}
          </Button>
        </div>
      </div>
      <div className="shell-body">
        <div className="shell-bar" role="group" aria-label={t('console.shell.toolsLabel')}>
          <DisplayControls />
        </div>
        <main id="main" className="shell-main" tabIndex={-1}>
          <Outlet />
        </main>
        <CreditsFooter />
      </div>
    </div>
  );
}
