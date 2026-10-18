import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiClientError,
  PHONE_NOT_PAKISTAN_MOBILE,
  PakistaniMobilePhone,
  issueCodeOf,
  issueMessageKey,
  type ApiClient,
} from '@qc/contracts';
import { errorCodeOf, retryAfterOf } from '../../api/errors';
import type { SignInResult } from '../../auth/AuthProvider';
import type { MessageKey } from '../../i18n/translate';
import { normalizePhone } from '../../lib/phone';

export type SignInStep = 'phone' | 'code';

export interface SignInState {
  step: SignInStep;
  phoneInput: string;
  /** The number the code was sent to, in E.164. Kept for the resend. */
  phone: string | null;
  code: string;
  busy: boolean;
  /** Seconds before another code may be asked for. 0 when it may be asked now. */
  resendIn: number;
  phoneError: MessageKey | null;
  codeError: MessageKey | null;
  /** A failure that is not about one field, such as being offline or rate limited. */
  notice: MessageKey | null;
  /** Seconds to wait, when a notice carries a wait. */
  waitSeconds: number | null;
}

export interface SignInActions {
  setPhoneInput: (value: string) => void;
  setCode: (value: string) => void;
  submitPhone: () => Promise<void>;
  submitCode: () => Promise<void>;
  resend: () => Promise<void>;
  changeNumber: () => void;
}

const DIGITS_ONLY = /^[0-9]{6}$/;

/** "Sign-in works only with a Pakistani mobile number, such as 0300 1234567." */
const NOT_PAKISTAN_MOBILE: MessageKey = issueMessageKey(PHONE_NOT_PAKISTAN_MOBILE);

/**
 * The message under the number field for a typed number, or null when a code may be asked for.
 * It is the contract's own check (`PakistaniMobilePhone`), so a number from abroad or a
 * Pakistani landline gets its message with no round trip.
 */
function phoneProblem(e164: string | null): MessageKey | null {
  if (!e164) return 'admin.signIn.phoneInvalid';
  const parsed = PakistaniMobilePhone.safeParse(e164);
  if (parsed.success) return null;
  return parsed.error.issues.some((i) => issueCodeOf(i) === PHONE_NOT_PAKISTAN_MOBILE)
    ? NOT_PAKISTAN_MOBILE
    : 'admin.signIn.phoneInvalid';
}

/** True when the server refused the number because it is not a Pakistani mobile number. */
function isNotPakistanMobile(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.code === 'validation_failed' &&
    (error.issues ?? []).some((i) => i.path === 'phone' && i.code === PHONE_NOT_PAKISTAN_MOBILE)
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
 * The phone-code sign-in as a small state machine, apart from any view. Step one asks for the
 * number and sends a code; step two takes the six digits. The number is never logged and never
 * kept after a successful sign-in beyond the sign-in response itself.
 */
export function useSignIn(
  publicApi: ApiClient,
  onSignedIn: (result: SignInResult) => Promise<void> | void,
  options: { locale: 'en' | 'ur' },
): SignInState & SignInActions {
  const [step, setStep] = useState<SignInStep>('phone');
  const [phoneInput, setPhoneInputState] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCodeState] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
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
    setPhoneError(null);
    setCodeError(null);
    setNotice(null);
    setWaitSeconds(null);
  };

  const sendCode = useCallback(
    async (e164: string): Promise<boolean> => {
      setBusy(true);
      clearMessages();
      try {
        const res = await publicApi.auth.requestCode({
          body: { phone: e164, locale: options.locale, channel: 'whatsapp' },
        });
        if (!mounted.current) return false;
        setChallengeId(res.challengeId);
        setResendIn(res.resendAfterSeconds);
        setPhone(e164);
        setStep('code');
        return true;
      } catch (error) {
        if (mounted.current) {
          if (isNotPakistanMobile(error)) {
            // The server's word on the number goes under the number field.
            setStep('phone');
            setPhoneError(NOT_PAKISTAN_MOBILE);
          } else {
            const n = noticeFor(error);
            setNotice(n.key);
            setWaitSeconds(n.wait);
          }
        }
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [publicApi, options.locale],
  );

  const submitPhone = useCallback(async () => {
    const e164 = normalizePhone(phoneInput);
    const problem = phoneProblem(e164);
    if (problem || !e164) {
      setPhoneError(problem ?? 'admin.signIn.phoneInvalid');
      return;
    }
    await sendCode(e164);
  }, [phoneInput, sendCode]);

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
      else {
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
    if (phone && resendIn <= 0) {
      setCodeState('');
      await sendCode(phone);
    }
  }, [phone, resendIn, sendCode]);

  const changeNumber = useCallback(() => {
    setStep('phone');
    setCodeState('');
    setChallengeId(null);
    clearMessages();
  }, []);

  return {
    step,
    phoneInput,
    phone,
    code,
    busy,
    resendIn,
    phoneError,
    codeError,
    notice,
    waitSeconds,
    setPhoneInput: (v) => {
      setPhoneInputState(v);
      setPhoneError(null);
    },
    setCode: (v) => {
      setCodeState(v.replace(/[^0-9]/g, '').slice(0, 6));
      setCodeError(null);
    },
    submitPhone,
    submitCode,
    resend,
    changeNumber,
  };
}
