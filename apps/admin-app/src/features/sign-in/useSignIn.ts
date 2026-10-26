import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, EmailAddress, issueMessageKey, type ApiClient } from '@qc/contracts';
import { errorCodeOf, retryAfterOf } from '../../api/errors';
import type { SignInResult } from '../../auth/AuthProvider';
import type { MessageKey } from '../../i18n/translate';
import { normalizePhone } from '../../lib/phone';

export type SignInStep = 'email' | 'code';

export interface SignInState {
  step: SignInStep;
  emailInput: string;
  /** The WhatsApp number, needed only the first time the email signs in. Optional here. */
  phoneInput: string;
  /** The address the code was sent to. Kept for the resend. */
  email: string | null;
  code: string;
  busy: boolean;
  /** Seconds before another code may be asked for. 0 when it may be asked now. */
  resendIn: number;
  emailError: MessageKey | null;
  phoneError: MessageKey | null;
  codeError: MessageKey | null;
  /** A failure that is not about one field, such as being offline or rate limited. */
  notice: MessageKey | null;
  /** Seconds to wait, when a notice carries a wait. */
  waitSeconds: number | null;
}

export interface SignInActions {
  setEmailInput: (value: string) => void;
  setPhoneInput: (value: string) => void;
  setCode: (value: string) => void;
  submitEmail: () => Promise<void>;
  submitCode: () => Promise<void>;
  resend: () => Promise<void>;
  changeEmail: () => void;
}

const DIGITS_ONLY = /^[0-9]{6}$/;

/** True when the server refused the request with this issue on this field. */
function hasIssue(error: unknown, path: string, code: string): boolean {
  return (
    error instanceof ApiClientError &&
    error.code === 'validation_failed' &&
    (error.issues ?? []).some((i) => i.path === path && i.code === code)
  );
}

function noticeFor(error: unknown): { key: MessageKey; wait: number | null } {
  const code = errorCodeOf(error);
  const wait = retryAfterOf(error) ?? null;
  if (code === 'network_error') return { key: 'ui.offlineBody', wait: null };
  if (code && code !== 'invalid_response') return { key: `errors.${code}` as MessageKey, wait };
  return { key: 'errors.internal_error', wait: null };
}

/**
 * The email-code sign-in as a small state machine, apart from any view. Step one asks for the
 * email (and, the first time only, the WhatsApp number) and sends a code; step two takes the six
 * digits. Neither is ever logged or kept after a successful sign-in beyond the response itself.
 */
export function useSignIn(
  publicApi: ApiClient,
  onSignedIn: (result: SignInResult) => Promise<void> | void,
  options: { locale: 'en' | 'ur' },
): SignInState & SignInActions {
  const [step, setStep] = useState<SignInStep>('email');
  const [emailInput, setEmailInputState] = useState('');
  const [phoneInput, setPhoneInputState] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCodeState] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [emailError, setEmailError] = useState<MessageKey | null>(null);
  const [phoneError, setPhoneError] = useState<MessageKey | null>(null);
  const [codeError, setCodeError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const clearMessages = () => {
    setEmailError(null);
    setPhoneError(null);
    setCodeError(null);
    setNotice(null);
    setWaitSeconds(null);
  };

  const sendCode = useCallback(
    async (address: string, whatsapp: string | null): Promise<boolean> => {
      setBusy(true);
      clearMessages();
      try {
        const res = await publicApi.auth.requestCode({
          body: {
            email: address,
            ...(whatsapp ? { phone: whatsapp } : {}),
            locale: options.locale,
            channel: 'email',
          },
        });
        if (!mounted.current) return false;
        setChallengeId(res.challengeId);
        setResendIn(res.resendAfterSeconds);
        setEmail(address);
        setPhone(whatsapp);
        setStep('code');
        return true;
      } catch (error) {
        if (mounted.current) {
          const n = noticeFor(error);
          setNotice(n.key);
          setWaitSeconds(n.wait);
        }
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [publicApi, options.locale],
  );

  const submitEmail = useCallback(async () => {
    const parsed = EmailAddress.safeParse(emailInput);
    if (!parsed.success) {
      setEmailError('admin.signIn.emailInvalid');
      return;
    }
    let whatsapp: string | null = null;
    if (phoneInput.trim()) {
      whatsapp = normalizePhone(phoneInput);
      if (!whatsapp) {
        setPhoneError('admin.signIn.phoneInvalid');
        return;
      }
    }
    await sendCode(parsed.data, whatsapp);
  }, [emailInput, phoneInput, sendCode]);

  const submitCode = useCallback(async () => {
    if (!DIGITS_ONLY.test(code)) {
      setCodeError('admin.signIn.codeInvalid');
      return;
    }
    if (!challengeId) return;
    setBusy(true);
    clearMessages();
    try {
      const result = await publicApi.auth.verifyCode({ body: { challengeId, code } });
      await onSignedIn(result);
    } catch (error) {
      if (!mounted.current) return;
      const c = errorCodeOf(error);
      if (c === 'otp_invalid') setCodeError('errors.otp_invalid');
      else if (hasIssue(error, 'phone', 'phone_required')) {
        // A first sign-in needs the WhatsApp number asked for with the code: back to step one.
        setStep('email');
        setCodeState('');
        setChallengeId(null);
        setPhoneError('admin.signIn.firstTimeNeeded');
      } else if (hasIssue(error, 'phone', 'phone_in_use')) {
        setStep('email');
        setCodeState('');
        setChallengeId(null);
        setPhoneError(issueMessageKey('phone_in_use'));
      } else {
        const n = noticeFor(error);
        setNotice(n.key);
        setWaitSeconds(n.wait);
        // An expired or exhausted code cannot be fixed by retyping it.
        if (c === 'otp_expired') setCodeState('');
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [challengeId, code, onSignedIn, publicApi]);

  const resend = useCallback(async () => {
    if (email && resendIn <= 0) {
      setCodeState('');
      await sendCode(email, phone);
    }
  }, [email, phone, resendIn, sendCode]);

  const changeEmail = useCallback(() => {
    setStep('email');
    setCodeState('');
    setChallengeId(null);
    clearMessages();
  }, []);

  return {
    step,
    emailInput,
    phoneInput,
    email,
    code,
    busy,
    resendIn,
    phoneError,
    codeError,
    notice,
    waitSeconds,
    emailError,
    setEmailInput: (v) => {
      setEmailInputState(v);
      setEmailError(null);
    },
    setPhoneInput: (v) => {
      setPhoneInputState(v);
      setPhoneError(null);
    },
    setCode: (v) => {
      setCodeState(v.replace(/[^0-9]/g, '').slice(0, 6));
      setCodeError(null);
    },
    submitEmail,
    submitCode,
    resend,
    changeEmail,
  };
}
