import { Link, Outlet, useLocation } from 'react-router';
import type { Role } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useFeatures } from '../api/features';
import { useI18n, type Locale } from '../i18n';
import { canSomewhere, visibleNav, type NavId } from '../lib/permissions';
import { useTheme, type ThemeChoice } from '../theme';
import type { TextSizeStep } from '../lib/ui-tokens';
import { useDirectory } from '../api/directory';
import { BrandLogo } from './BrandLogo';
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

/**
 * The menu of the console artboard. Registrations and QR posters belong to one session each, so
 * their entries open the sessions list, where the inspector of the chosen session links to them;
 * they show as current while a session's registrations or posters are open.
 */
type MenuId = NavId | 'registrations' | 'posters';
const MENU_ORDER: readonly MenuId[] = [
  'venues',
  'sessions',
  'coordinators',
  'registrations',
  'dailyAyahs',
  'posters',
  'import',
  'exports',
  'audit',
  'settings',
];

interface MenuEntry {
  id: MenuId;
  path: string;
  label: string;
  icon: IconName;
  /** A hint for entries that open the sessions list first. */
  hint?: string;
  active(pathname: string): boolean;
}

const sessionPage = (pathname: string, page: string) =>
  new RegExp(`^/sessions/[^/]+/${page}$`).test(pathname);

const SCOPE_KEYS = {
  national_admin: 'console.shell.scope.national',
  city_coordinator: 'console.shell.scope.city',
  venue_coordinator: 'console.shell.scope.venue',
} as const satisfies Record<Role, MessageKey>;

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

/** EN and اردو side by side in the top bar; the full display settings stay in the rail's panel. */
function LanguageSwitch() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div
      className="segmented lang-switch"
      role="group"
      aria-label={t('console.shell.languageSwitch')}
    >
      {(
        [
          ['en', 'EN'],
          ['ur', 'اردو'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className="segment"
          aria-pressed={locale === id}
          lang={id}
          onClick={() => setLocale(id)}
        >
          {label}
        </button>
      ))}
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
  const { t, tx } = useI18n();
  const { me, principal, signOut } = useSignedIn();
  const features = useFeatures();
  const { pathname } = useLocation();
  const visible = visibleNav(principal, features.flags);
  const entries: MenuEntry[] = MENU_ORDER.flatMap((id): MenuEntry[] => {
    if (id === 'registrations' || id === 'posters') {
      const action = id === 'registrations' ? 'registration.list' : 'poster.read';
      if (!canSomewhere(principal, action)) return [];
      return [
        {
          id,
          path: '/sessions',
          label: t(id === 'registrations' ? 'console.nav.registrations' : 'console.nav.posters'),
          icon: id === 'registrations' ? 'users-three' : 'qr-code',
          hint: t('console.nav.pickSession'),
          active: (path) => sessionPage(path, id),
        },
      ];
    }
    const item = visible.find((i) => i.id === id);
    if (!item) return [];
    return [
      {
        id,
        path: item.path,
        label: t(item.labelKey),
        icon: NAV_ICONS[item.id],
        active: (path) =>
          id === 'sessions'
            ? path.startsWith('/sessions') &&
              !sessionPage(path, 'registrations') &&
              !sessionPage(path, 'posters')
            : path === item.path || path.startsWith(`${item.path}/`),
      },
    ];
  });
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
            <BrandLogo size={34} />
            <span className="brand-text">
              <span className="brand-name">{t('app.name')}</span>
              <span className="brand-sub">{t('console.shell.brandSub')}</span>
            </span>
          </div>
          <nav className="shell-nav" aria-label={t('console.shell.navLabel')}>
            <ul>
              {entries.map((entry) => {
                const isActive = entry.active(pathname);
                return (
                  <li key={entry.id}>
                    <Link
                      className={isActive ? 'nav-link active' : 'nav-link'}
                      to={entry.path}
                      aria-current={isActive ? 'page' : undefined}
                      title={entry.hint}
                    >
                      <Icon name={entry.icon} size={16} weight={isActive ? 'fill' : 'duotone'} />
                      <span className="nav-label">{entry.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="shell-user">
          <section className="operator" aria-label={t('console.shell.signedInLabel')}>
            <span className="shell-user-name">{name}</span>
            <span className="operator-role">
              {roleText}
              {widest ? ` · ${t(SCOPE_KEYS[widest])}` : ''}
            </span>
          </section>
          <details className="shell-tools">
            <summary
              aria-label={t('console.shell.toolsLabel')}
              title={t('console.shell.toolsLabel')}
            >
              <Icon name="translate" size={14} weight="bold" />
            </summary>
            <div className="shell-tools-panel">
              <section className="shell-bar" aria-label={t('console.shell.toolsLabel')}>
                <DisplayControls />
              </section>
              <Button variant="outline" className="btn-small" onClick={() => void signOut()}>
                {t('console.shell.signOut')}
              </Button>
            </div>
          </details>
        </div>
      </header>
      <div className="shell-body">
        <div className="shell-top">
          <section className="top-filters" aria-label={t('console.shell.filters')}>
            <CityPills />
            <TopSearch />
          </section>
          <LanguageSwitch />
        </div>
        <main id="main" className="shell-main" tabIndex={-1}>
          <Outlet />
        </main>
        <CreditsFooter />
      </div>
    </div>
  );
}
