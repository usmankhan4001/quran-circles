import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth, useSignedIn } from './api/auth';
import { DirectoryProvider } from './api/directory';
import { FeaturesProvider, useFeatures } from './api/features';
import { Shell } from './components/Shell';
import { EmptyState, Loading } from './components/ui';
import { I18nProvider, useI18n, type Locale } from './i18n';
import { NAV_ITEMS, roleAllowsNav, visibleNav, type NavId } from './lib/permissions';
import type { KeyValueStore } from './lib/storage';
import AuditPage from './pages/AuditPage';
import CoordinatorsPage from './pages/CoordinatorsPage';
import DailyAyahsPage from './pages/DailyAyahsPage';
import ExportsPage from './pages/ExportsPage';
import ImportPage from './pages/ImportPage';
import PostersPage from './pages/PostersPage';
import RegistrationsPage from './pages/RegistrationsPage';
import SessionsPage from './pages/SessionsPage';
import SettingsPage from './pages/SettingsPage';
import SignInPage from './pages/SignInPage';
import VenuesPage from './pages/VenuesPage';
import WelcomePage from './pages/WelcomePage';
import { ThemeProvider, type ThemeChoice } from './theme';
import type { TextSizeStep } from './lib/ui-tokens';

export interface AppProvidersProps {
  /** The API origin from public configuration. '' means same origin (the dev proxy). */
  apiBaseUrl: string;
  children: ReactNode;
  fetchImpl?: typeof fetch;
  /** For tests: fixed language, theme and text size, and in-memory storage. */
  initialLocale?: Locale;
  initialTheme?: ThemeChoice;
  initialTextStep?: TextSizeStep;
  displayStore?: KeyValueStore;
  tokenStore?: KeyValueStore;
}

export function AppProviders({
  apiBaseUrl,
  children,
  fetchImpl,
  initialLocale,
  initialTheme,
  initialTextStep,
  displayStore,
  tokenStore,
}: AppProvidersProps) {
  return (
    <I18nProvider
      {...(initialLocale ? { initialLocale } : {})}
      {...(displayStore ? { store: displayStore } : {})}
    >
      <ThemeProvider
        {...(initialTheme ? { initialChoice: initialTheme } : {})}
        {...(initialTextStep !== undefined ? { initialTextStep } : {})}
        {...(displayStore ? { store: displayStore } : {})}
      >
        <AuthProvider
          baseUrl={apiBaseUrl}
          {...(fetchImpl ? { fetchImpl } : {})}
          {...(tokenStore ? { tokenStore } : {})}
        >
          {children}
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

/** Sends signed-out people to sign in, and remembers where they were going. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Loading />;
  if (status === 'signedOut')
    return <Navigate to="/welcome" replace state={{ from: location.pathname + location.search }} />;
  return (
    <FeaturesProvider>
      <DirectoryProvider>{children}</DirectoryProvider>
    </FeaturesProvider>
  );
}

/**
 * A page the person's roles do not unlock (the API would refuse it too), or a page whose feature
 * flag is off. Nothing on the page loads in either case.
 */
function Guard({ nav, children }: { nav: NavId; children: ReactNode }) {
  const { t } = useI18n();
  const { principal } = useSignedIn();
  const features = useFeatures();
  const item = NAV_ITEMS.find((i) => i.id === nav);
  if (!item || !roleAllowsNav(principal, item))
    return (
      <div className="page">
        <EmptyState
          title={t('console.shell.forbidden.title')}
          body={t('console.shell.forbidden.body')}
        />
      </div>
    );
  if (item.flag !== undefined && !features.on(item.flag)) {
    if (features.status === 'loading') return <Loading />;
    return (
      <div className="page">
        <EmptyState
          title={t('console.shell.featureOff.title')}
          body={t('console.shell.featureOff.body')}
        />
      </div>
    );
  }
  return <>{children}</>;
}

function Home() {
  const { principal } = useSignedIn();
  const features = useFeatures();
  const first = visibleNav(principal, features.flags)[0];
  return first ? <Navigate to={first.path} replace /> : <NotFound />;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="page">
      <EmptyState
        title={t('console.shell.notFound.title')}
        body={t('console.shell.notFound.body')}
      />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="/sessions"
          element={
            <Guard nav="sessions">
              <SessionsPage />
            </Guard>
          }
        />
        <Route
          path="/sessions/:sessionId/registrations"
          element={
            <Guard nav="sessions">
              <RegistrationsPage />
            </Guard>
          }
        />
        <Route
          path="/sessions/:sessionId/posters"
          element={
            <Guard nav="sessions">
              <PostersPage />
            </Guard>
          }
        />
        <Route
          path="/venues"
          element={
            <Guard nav="venues">
              <VenuesPage />
            </Guard>
          }
        />
        <Route
          path="/exports"
          element={
            <Guard nav="exports">
              <ExportsPage />
            </Guard>
          }
        />
        <Route
          path="/coordinators"
          element={
            <Guard nav="coordinators">
              <CoordinatorsPage />
            </Guard>
          }
        />
        <Route
          path="/import"
          element={
            <Guard nav="import">
              <ImportPage />
            </Guard>
          }
        />
        <Route
          path="/audit"
          element={
            <Guard nav="audit">
              <AuditPage />
            </Guard>
          }
        />
        <Route
          path="/ayah-of-the-day"
          element={
            <Guard nav="dailyAyahs">
              <DailyAyahsPage />
            </Guard>
          }
        />
        <Route
          path="/settings"
          element={
            <Guard nav="settings">
              <SettingsPage />
            </Guard>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
