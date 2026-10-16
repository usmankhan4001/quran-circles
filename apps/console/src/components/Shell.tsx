import { NavLink, Outlet } from 'react-router';
import type { Role } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useI18n, type Locale } from '../i18n';
import { visibleNav } from '../lib/permissions';
import { useTheme, type ThemeChoice } from '../theme';
import type { TextSizeStep } from '../lib/ui-tokens';
import { Button, SelectField } from './ui';

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

/** The signed-in frame: header, a menu with only the pages the person may use, and the page. */
export function Shell() {
  const { t, tx } = useI18n();
  const { me, principal, signOut } = useSignedIn();
  const items = visibleNav(principal);
  const roles = [...new Set(me.roles.map((r) => r.role))];

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t('console.shell.skipToContent')}
      </a>
      <header className="shell-header">
        <span className="brand">{t('console.shell.appTitle')}</span>
        <div className="shell-tools">
          <DisplayControls />
        </div>
        <div className="shell-user">
          <div>
            <div className="shell-user-name">{me.displayName ?? t('console.shell.unnamed')}</div>
            <div className="shell-user-role">{roles.map((r) => tx(ROLE_KEYS[r])).join(', ')}</div>
          </div>
          <Button onClick={() => void signOut()}>{t('console.shell.signOut')}</Button>
        </div>
      </header>
      <nav className="shell-nav" aria-label={t('console.shell.navLabel')}>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <NavLink className="nav-link" to={item.path}>
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
