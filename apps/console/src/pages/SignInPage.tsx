import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { EmailAddress, issueMessageKey } from '@qc/contracts';
import { useAuth } from '../api/auth';
import { BrandLogo } from '../components/BrandLogo';
import { DisplayControls } from '../components/Shell';
import { Icon } from '../components/icons';
import { Banner, Button, PageHeader, TextField } from '../components/ui';
import { useI18n } from '../i18n';
import { ltrRun } from '../lib/ui-tokens';
import { errorMessageKeyOf, issuesOf } from '../lib/errors';
import { PHONE_ISSUE_KEYS, normalizePhone, toAsciiDigits } from '../lib/phone';

/** True when `auth.verifyCode` refused a first sign-in with this issue on the WhatsApp number. */
function refusedWith(error: unknown, code: string): boolean {
  return issuesOf(error).some((i) => i.path === 'phone' && i.code === code);
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
  email: string;
  /** The WhatsApp number sent with the request (first sign-in), kept for the resend. */
  phone: string | null;
  /** Seconds until a new code may be requested, counted down on screen. */
  resendIn: number;
}

/** Coordinators sign in with a code sent to their email. The WhatsApp number is for a first sign-in. */
export default function SignInPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
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
    // A resend asks again for the address and number the first code went to.
    const resend = event === undefined && challenge !== null;
    let address = challenge?.email ?? '';
    let whatsapp: string | null = challenge?.phone ?? null;
    if (!resend) {
      const parsed = EmailAddress.safeParse(email);
      if (!parsed.success) {
        setEmailError(t('console.signIn.email.invalid'));
        return;
      }
      address = parsed.data;
      whatsapp = null;
      if (phone.trim()) {
        const result = normalizePhone(phone);
        if (!result.ok) {
          setPhoneError(t(PHONE_ISSUE_KEYS[result.issue]));
          return;
        }
        whatsapp = result.e164;
      }
    }
    setEmailError(null);
    setPhoneError(null);
    setFailure(null);
    setNoAccess(false);
    setBusy(true);
    try {
      const res = await auth.requestCode(address, whatsapp);
      setChallenge({
        id: res.challengeId,
        email: address,
        phone: whatsapp,
        resendIn: res.resendAfterSeconds,
      });
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
      if (refusedWith(error, 'phone_required') || refusedWith(error, 'phone_in_use')) {
        // A first sign-in needs a WhatsApp number asked for with the code: back to step one.
        setChallenge(null);
        setCode('');
        setPhoneError(
          t(
            refusedWith(error, 'phone_in_use')
              ? issueMessageKey('phone_in_use')
              : 'console.signIn.phone.needed',
          ),
        );
      } else setFailure(error);
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
          <BrandLogo size={80} />
          <PageHeader
            title={t(challenge ? 'console.signIn.code.title' : 'console.signIn.title')}
            intro={
              challenge
                ? t('console.signIn.code.sent', { email: ltrRun(challenge.email) })
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
                id="signin-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                label={t('console.signIn.email.label')}
                hint={t('console.signIn.email.hint')}
                error={emailError}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                required
              />
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
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                }}
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
                  {t('console.signIn.changeEmail')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
