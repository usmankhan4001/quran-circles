import { Link, Navigate, useLocation } from 'react-router';
import { useAuth } from '../api/auth';
import { BrandLogo } from '../components/BrandLogo';
import { Icon, type IconName } from '../components/icons';
import { DisplayControls } from '../components/Shell';
import { useI18n } from '../i18n';
import type { MessageKey } from '@qc/i18n';

const POINTS: readonly { icon: IconName; key: MessageKey }[] = [
  { icon: 'calendar-blank', key: 'console.welcome.point.sessions' },
  { icon: 'users-three', key: 'console.welcome.point.people' },
  { icon: 'download-simple', key: 'console.welcome.point.exports' },
];

/** Where signed-out people land: what the console is for, and one way in. */
export default function WelcomePage() {
  const { t } = useI18n();
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  if (auth.status === 'signedIn') return <Navigate to={from ?? '/'} replace />;

  return (
    <div className="welcome">
      <section className="welcome-brand" aria-labelledby="welcome-hero-title">
        <div className="welcome-name">
          <BrandLogo size={72} className="welcome-logo" />
          <span>{t('app.name')}</span>
        </div>
        <div className="welcome-pitch">
          <h2 id="welcome-hero-title" className="welcome-hero">
            {t('console.welcome.hero')}
          </h2>
          <p>{t('console.welcome.heroBody')}</p>
          <ul className="welcome-points">
            {POINTS.map((p) => (
              <li key={p.key}>
                <span className="welcome-ring">
                  <Icon name={p.icon} size={20} />
                </span>
                {t(p.key)}
              </li>
            ))}
          </ul>
        </div>
        <span className="welcome-foot">{t('console.welcome.audience')}</span>
      </section>
      <main className="welcome-main">
        <div className="welcome-tools" role="group" aria-label={t('console.shell.toolsLabel')}>
          <DisplayControls />
        </div>
        <div className="welcome-card">
          <div>
            <h1>{t('console.welcome.title')}</h1>
            <p className="page-intro">{t('console.welcome.intro')}</p>
          </div>
          <Link className="btn btn-primary" to="/sign-in" state={from ? { from } : null}>
            <Icon name="phone" size="sm" />
            {t('console.welcome.signIn')}
          </Link>
          <p className="welcome-note">
            <Icon name="lock-simple" size="sm" />
            {t('console.welcome.invitedOnly')}
          </p>
        </div>
      </main>
    </div>
  );
}
