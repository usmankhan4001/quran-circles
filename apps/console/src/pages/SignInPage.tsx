import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../api/auth';
import { DisplayControls } from '../components/Shell';
import { Icon, PatternLayer } from '../components/icons';
import { Banner, Button, PageHeader, TextField } from '../components/ui';
import { useI18n } from '../i18n';
import { errorMessageKeyOf } from '../lib/errors';
import { PHONE_ISSUE_KEYS, normalizePhone, toAsciiDigits } from '../lib/phone';

interface Challenge {
  id: string;
  /** Seconds until a new code may be requested, counted down on screen. */
  resendIn: number;
}

/** Coordinators sign in with a code sent to their WhatsApp number. */
export default function SignInPage() {
  const { t, number } = useI18n();
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [noAccess, setNoAccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const waiting = challenge !== null && challenge.resendIn > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      setChallenge((c) => (c ? { ...c, resendIn: Math.max(0, c.resendIn - 1) } : c));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  if (auth.status === 'signedIn') return <Navigate to={from} replace />;

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    const result = normalizePhone(phone, { mobileOnly: true });
    if (!result.ok) {
      setPhoneError(t(PHONE_ISSUE_KEYS[result.issue]));
      return;
    }
    setPhoneError(null);
    setFailure(null);
    setNoAccess(false);
    setBusy(true);
    try {
      const res = await auth.requestCode(result.e164);
      setChallenge({ id: res.challengeId, resendIn: res.resendAfterSeconds });
      setCode('');
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    const digits = toAsciiDigits(code).replace(/\s/g, '');
    if (!/^[0-9]{6}$/.test(digits)) {
      setCodeError(t('console.signIn.code.invalid'));
      return;
    }
    setCodeError(null);
    setFailure(null);
    setBusy(true);
    try {
      const result = await auth.verifyCode(challenge.id, digits);
      if (!result.ok) {
        setNoAccess(true);
        setChallenge(null);
        setCode('');
      }
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-tools" role="group" aria-label={t('console.shell.toolsLabel')}>
        <DisplayControls />
      </div>
      <div className="card auth-card">
        <div className="auth-hero">
          <PatternLayer />
          <span className="brand-mark brand-mark-large">
            <Icon name="halaqa" />
          </span>
          <PageHeader title={t('console.signIn.title')} intro={t('console.signIn.intro')} />
        </div>
        <div className="auth-body">
          {noAccess ? (
            <Banner tone="danger" title={t('console.signIn.noAccess.title')}>
              {t('console.signIn.noAccess.body')}
            </Banner>
          ) : null}
          {failure ? <Banner tone="danger">{t(errorMessageKeyOf(failure))}</Banner> : null}

          {challenge === null ? (
            <form className="form" onSubmit={(e) => void sendCode(e)} noValidate>
              <TextField
                id="signin-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                label={t('console.signIn.phone.label')}
                hint={t('console.signIn.phone.hint')}
                error={phoneError}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <div className="form-actions">
                <Button type="submit" variant="primary" busy={busy}>
                  {t('console.signIn.sendCode')}
                </Button>
              </div>
            </form>
          ) : (
            <form className="form" onSubmit={(e) => void verify(e)} noValidate>
              <TextField
                id="signin-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={12}
                label={t('console.signIn.code.label')}
                hint={t('console.signIn.code.hint')}
                error={codeError}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <div className="form-actions">
                <Button type="submit" variant="primary" busy={busy}>
                  {t('console.signIn.verify')}
                </Button>
                <Button
                  disabled={waiting || busy}
                  onClick={() => {
                    void sendCode();
                  }}
                >
                  {t('console.signIn.resend')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setChallenge(null);
                    setFailure(null);
                  }}
                >
                  {t('console.signIn.changeNumber')}
                </Button>
              </div>
              {waiting ? (
                <p className="field-hint">
                  {t('console.signIn.resendIn', { seconds: number(challenge.resendIn) })}
                </p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
