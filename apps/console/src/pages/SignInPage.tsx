import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PHONE_NOT_PAKISTAN_MOBILE, PakistaniMobilePhone, issueMessageKey } from '@qc/contracts';
import { useAuth } from '../api/auth';
import { DisplayControls } from '../components/Shell';
import { Icon } from '../components/icons';
import { Banner, Button, PageHeader, TextField } from '../components/ui';
import { useI18n } from '../i18n';
import { ltrRun } from '../lib/ui-tokens';
import { errorMessageKeyOf, issuesOf } from '../lib/errors';
import { PHONE_ISSUE_KEYS, formatPhone, normalizePhone, toAsciiDigits } from '../lib/phone';

/** "Sign-in works only with a Pakistani mobile number, such as 0300 1234567." */
const NOT_PAKISTAN_MOBILE = issueMessageKey(PHONE_NOT_PAKISTAN_MOBILE);

/** True when `auth.requestCode` refused the number as not a Pakistani mobile. */
function refusedAsNotPakistanMobile(error: unknown): boolean {
  return issuesOf(error).some((i) => i.path === 'phone' && i.code === PHONE_NOT_PAKISTAN_MOBILE);
}

/**
 * The code as six boxes. One real input sits invisibly over them, so paste, one-time-code fill and
 * screen readers work as for any field; the boxes only draw what it holds.
 */
function CodeBoxes({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}) {
  const errorId = useId();
  const digits = toAsciiDigits(value).replace(/\D/g, '').slice(0, 6);
  return (
    <div className="code-field">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="code-boxes" dir="ltr">
        <input
          id={id}
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={12}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          required
        />
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className="code-digit"
            aria-hidden="true"
            data-current={i === Math.min(digits.length, 5) ? 'true' : undefined}
          >
            {digits[i] ?? ''}
          </span>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

interface Challenge {
  id: string;
  phone: string;
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
      // A landline is a real number that cannot sign in: the same words as the server's.
      setPhoneError(
        t(result.issue === 'not_mobile' ? NOT_PAKISTAN_MOBILE : PHONE_ISSUE_KEYS[result.issue]),
      );
      return;
    }
    // The contract's own check, so a number from abroad is told no without a round trip.
    if (!PakistaniMobilePhone.safeParse(result.e164).success) {
      setPhoneError(t(NOT_PAKISTAN_MOBILE));
      return;
    }
    setPhoneError(null);
    setFailure(null);
    setNoAccess(false);
    setBusy(true);
    try {
      const res = await auth.requestCode(result.e164);
      setChallenge({ id: res.challengeId, phone: result.e164, resendIn: res.resendAfterSeconds });
      setCode('');
    } catch (error) {
      if (refusedAsNotPakistanMobile(error)) {
        setChallenge(null);
        setPhoneError(t(NOT_PAKISTAN_MOBILE));
      } else setFailure(error);
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
          <span className="brand-mark brand-mark-large">
            <Icon name="mosque" />
          </span>
          <PageHeader
            title={t(challenge ? 'console.signIn.code.title' : 'console.signIn.title')}
            intro={
              challenge
                ? t('console.signIn.code.sent', { phone: ltrRun(formatPhone(challenge.phone)) })
                : t('console.signIn.intro')
            }
          />
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
              <CodeBoxes
                id="signin-code"
                label={t('console.signIn.code.label')}
                value={code}
                onChange={setCode}
                error={codeError}
              />
              {waiting ? (
                <p className="field-hint code-timer">
                  {t('console.signIn.resendTimer', { time: ltrRun(clock(challenge.resendIn)) })}
                </p>
              ) : null}
              <div className="form-actions">
                <Button type="submit" variant="primary" busy={busy}>
                  <Icon name="check" size="sm" />
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
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
