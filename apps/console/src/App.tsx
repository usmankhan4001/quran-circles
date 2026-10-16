import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth, useSignedIn } from './api/auth';
import { DirectoryProvider } from './api/directory';
import { Shell } from './components/Shell';
import { EmptyState, Loading } from './components/ui';
import { I18nProvider, useI18n, type Locale } from './i18n';
import { isNavAllowed, visibleNav, type NavId } from './lib/permissions';
import type { KeyValueStore } from './lib/storage';
import AuditPage from './pages/AuditPage';
import CoordinatorsPage from './pages/CoordinatorsPage';
import ExportsPage from './pages/ExportsPage';
import ImportPage from './pages/ImportPage';
import RegistrationsPage from './pages/RegistrationsPage';
import SessionsPage from './pages/SessionsPage';
import SettingsPage from './pages/SettingsPage';
import SignInPage from './pages/SignInPage';
import VenuesPage from './pages/VenuesPage';
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
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <DirectoryProvider>{children}</DirectoryProvider>;
}

/** A page the person's roles do not unlock. The API would refuse it too. */
function Guard({ nav, children }: { nav: NavId; children: ReactNode }) {
  const { t } = useI18n();
  const { principal } = useSignedIn();
  if (!isNavAllowed(principal, nav))
    return (
      <div className="page">
        <EmptyState
          title={t('console.shell.forbidden.title')}
          body={t('console.shell.forbidden.body')}
        />
      </div>
    );
  return <>{children}</>;
}

function Home() {
  const { principal } = useSignedIn();
  const first = visibleNav(principal)[0];
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
