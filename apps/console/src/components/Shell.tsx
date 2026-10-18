import { NavLink, Outlet } from 'react-router';
import type { Role, SeasonMode } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useFeatures } from '../api/features';
import { useI18n, type Locale } from '../i18n';
import { visibleNav, type NavId } from '../lib/permissions';
import { useTheme, type ThemeChoice } from '../theme';
import type { TextSizeStep } from '../lib/ui-tokens';
import { useDirectory } from '../api/directory';
import { Icon, type IconName } from './icons';
import { ShellFiltersProvider, useShellCity, useShellFilters } from './ShellFilters';
import { Button, SearchField, SelectField } from './ui';
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
  sessions: 'calendar-blank',
  venues: 'mosque',
  exports: 'download-simple',
  coordinators: 'users-three',
  import: 'file-csv',
  audit: 'shield-check',
  dailyAyahs: 'book-open-text',
  settings: 'sliders-horizontal',
} as const satisfies Record<NavId, IconName>;

/** The menu order of the console artboard; the routes keep their own order. */
const NAV_ORDER: readonly NavId[] = [
  'venues',
  'sessions',
  'coordinators',
  'dailyAyahs',
  'import',
  'exports',
  'audit',
  'settings',
];

const SCOPE_KEYS = {
  national_admin: 'console.shell.scope.national',
  city_coordinator: 'console.shell.scope.city',
  venue_coordinator: 'console.shell.scope.venue',
} as const satisfies Record<Role, MessageKey>;

const SEASON_KEYS = {
  dora: 'console.settings.season.dora',
  circles: 'console.settings.season.circles',
} as const satisfies Record<SeasonMode, MessageKey>;

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

/** The widest role the person holds names their scope. */
function widestRole(roles: readonly Role[]): Role | null {
  for (const r of ['national_admin', 'city_coordinator', 'venue_coordinator'] as const)
    if (roles.includes(r)) return r;
  return null;
}

/** The top bar's city pills: every city that has a venue in the person's scope. */
function CityPills() {
  const { t, localized } = useI18n();
  const dir = useDirectory();
  const [cityId, setCityId] = useShellCity();
  const inScope = new Set(dir.venues.map((v) => v.cityId));
  const cities = dir.cities.filter((c) => inScope.has(c.id));
  if (cities.length < 2) return null;
  const options = [
    { id: '', label: t('console.shell.allCities') },
    ...cities.map((c) => ({ id: c.id, label: localized(c.name) })),
  ];
  return (
    <div className="city-filter">
      <span className="city-prefix" aria-hidden="true">
        <Icon name="map-pin" size={14} weight="duotone" />
        <span>{t('console.shell.cityPrefix')}</span>
      </span>
      <div className="city-pills" role="group" aria-label={t('console.shell.cityPills')}>
        {options.map((o) => (
          <button
            key={o.id || 'all'}
            type="button"
            className="city-pill"
            aria-pressed={o.id === cityId}
            onClick={() => setCityId(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The top bar's search pill, shown while the page on screen has a search. */
function TopSearch() {
  const filters = useShellFilters();
  if (!filters?.searchLabel) return <span className="top-search-space" />;
  return (
    <SearchField
      id="top-search"
      label={filters.searchLabel}
      value={filters.query}
      onChange={filters.setQuery}
      className="top-search"
    />
  );
}

/**
 * The signed-in frame, as on the console artboard: a white 220 px sidebar topped by the deep
 * emerald brand block, the season pill, the menu with only the pages the person may use, and at its
 * foot the scope they work in, the display settings and sign out. The white top bar has the city
 * pills, the page's search and who is signed in; the page sits below on the slate cloud. The
 * sidebar sits at the start edge, so it moves to the right in Urdu by itself.
 */
export function Shell() {
  return (
    <ShellFiltersProvider>
      <ShellFrame />
    </ShellFiltersProvider>
  );
}

function ShellFrame() {
  const { t, tx, number } = useI18n();
  const { me, principal, signOut } = useSignedIn();
  const features = useFeatures();
  const visible = visibleNav(principal, features.flags);
  const items = NAV_ORDER.flatMap((id) => visible.filter((i) => i.id === id));
  const roles = [...new Set(me.roles.map((r) => r.role))];
  const roleText = roles.map((r) => tx(ROLE_KEYS[r])).join(', ');
  const widest = widestRole(roles);
  const name = me.displayName ?? t('console.shell.unnamed');

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t('console.shell.skipToContent')}
      </a>
      {/* Landmarks (A-08): the sidebar is the page's banner (brand, menu, scope, display settings
          and sign out), the top bar's filters and who is signed in are named regions, the page is
          main and the credits the content info, so nothing sits outside a landmark. */}
      <header className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="mosque" size={19} weight="duotone" />
            </span>
            <span className="brand-text">
              <span className="brand-name">{t('app.name')}</span>
              <span className="brand-sub">{t('console.shell.brandSub')}</span>
            </span>
          </div>
          {features.seasonMode ? (
            <p className="season-pill">
              <span className="season-name">
                <Icon name="moon-stars" size={13} weight="fill" />
                <span>
                  {t('console.shell.season', { season: t(SEASON_KEYS[features.seasonMode]) })}
                </span>
              </span>
              {features.hijriOffsetDays !== null ? (
                <span className="season-hijri">
                  {t('console.shell.hijri', { days: number(features.hijriOffsetDays) })}
                </span>
              ) : null}
            </p>
          ) : null}
          <nav className="shell-nav" aria-label={t('console.shell.navLabel')}>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <NavLink className="nav-link" to={item.path}>
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={NAV_ICONS[item.id]}
                          size={16}
                          weight={isActive ? 'fill' : 'duotone'}
                        />
                        <span>{t(item.labelKey)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="shell-user">
          <div className="shell-scope">
            <span className="scope-dot" aria-hidden="true" />
            <span className="scope-text">
              <span className="scope-name">{widest ? t(SCOPE_KEYS[widest]) : roleText}</span>
              <span className="scope-sub">{t('console.shell.scope.locales')}</span>
            </span>
            <Icon name="translate" size={14} weight="bold" />
          </div>
          <section className="shell-bar" aria-label={t('console.shell.toolsLabel')}>
            <DisplayControls />
          </section>
          <Button variant="outline" className="btn-small" onClick={() => void signOut()}>
            {t('console.shell.signOut')}
          </Button>
        </div>
      </header>
      <div className="shell-body">
        <div className="shell-top">
          <section className="top-filters" aria-label={t('console.shell.filters')}>
            <CityPills />
            <TopSearch />
          </section>
          <section className="operator" aria-label={t('console.shell.signedInLabel')}>
            <span className="avatar" aria-hidden="true">
              {initialsOf(name)}
            </span>
            <span className="operator-text">
              <span className="shell-user-name">{name}</span>
              <span className="operator-role">{roleText}</span>
            </span>
          </section>
        </div>
        <main id="main" className="shell-main" tabIndex={-1}>
          <Outlet />
        </main>
        <CreditsFooter />
      </div>
    </div>
  );
}
