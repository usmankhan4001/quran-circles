import { useCallback, useEffect, useRef, useState } from 'react';
import type { OtpChannel } from '@qc/contracts';
import { toAppError, type AppError } from '../../core/errors';
import { useI18n } from '../../i18n/I18nProvider';
import { useServices } from '../../providers/services';
import {
  checkCode,
  checkEmail,
  checkName,
  checkWhatsAppNumber,
  hasIssue,
  type FieldProblem,
} from './validation';

export type SignInStep = 'email' | 'code' | 'name' | 'done';

interface Challenge {
  challengeId: string;
  channel: OtpChannel;
  /** When the next code may be asked for, in milliseconds since 1970. */
  resendAt: number;
}

export interface SignInFlow {
  step: SignInStep;
  emailInput: string;
  setEmailInput: (value: string) => void;
  /** The WhatsApp number (sign up only). */
  phoneInput: string;
  setPhoneInput: (value: string) => void;
  codeInput: string;
  setCodeInput: (value: string) => void;
  nameInput: string;
  setNameInput: (value: string) => void;
  /** The channel the current code was sent on. */
  channel: OtpChannel | null;
  working: boolean;
  problem: FieldProblem | null;
  error: AppError | undefined;
  /** Seconds before another code may be sent. Zero when it may. */
  resendIn: number;
  /** The address the current code was sent to. */
  email: string | null;
  submitEmail: () => Promise<void>;
  submitCode: () => Promise<void>;
  resend: () => Promise<void>;
  submitName: () => Promise<void>;
  skipName: () => void;
  changeEmail: () => void;
}

/** Seconds from `now` until `target`, rounded up, never negative. */
export function secondsUntil(target: number, now: number): number {
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/**
 * Email, then the code sent to it, then, for a new account, a name. Signing up also asks for the
 * WhatsApp number (`askPhone`): a new account cannot be made without it. The screen only draws
 * this; every rule is here and in `validation.ts`.
 */
export function useSignIn(
  onDone: () => void,
  options: {
    /** A name asked for earlier (sign up). A new account is given it and skips the name step. */
    presetName?: string;
    /** Sign up: the WhatsApp number is asked for with the email and is required. */
    askPhone?: boolean;
  } = {},
): SignInFlow {
  const { api, auth, now } = useServices();
  const { locale } = useI18n();
  const [step, setStep] = useState<SignInStep>('email');
  const [emailInput, setEmailInput] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<FieldProblem | null>(null);
  const [error, setError] = useState<AppError | undefined>();
  const [tick, setTick] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!challenge) return;
    if (challenge.resendAt <= now().getTime()) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [challenge, now]);

  // `tick` re-renders every second while the countdown runs, and this re-reads the clock.
  void tick;
  const resendIn = challenge ? secondsUntil(challenge.resendAt, now().getTime()) : 0;

  const guard = useCallback(async (work: () => Promise<void>) => {
    setWorking(true);
    setProblem(null);
    setError(undefined);
    try {
      await work();
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setWorking(false);
    }
  }, []);

  const requestCode = useCallback(
    async (address: string, whatsapp: string | null) => {
      const response = await api.auth.requestCode({
        body: {
          email: address,
          ...(whatsapp ? { phone: whatsapp } : {}),
          locale,
          channel: 'email',
        },
      });
      setEmail(address);
      setPhone(whatsapp);
      setChallenge({
        challengeId: response.challengeId,
        channel: response.channel,
        resendAt: now().getTime() + response.resendAfterSeconds * 1000,
      });
      setCodeInput('');
      setStep('code');
    },
    [api, locale, now],
  );

  const submitEmail = useCallback(
    () =>
      guard(async () => {
        const checkedEmail = checkEmail(emailInput);
        if ('problem' in checkedEmail) {
          setProblem(checkedEmail.problem);
          return;
        }
        let whatsapp: string | null = null;
        if (options.askPhone) {
          const checkedPhone = checkWhatsAppNumber(phoneInput);
          if ('problem' in checkedPhone) {
            setProblem(checkedPhone.problem);
            return;
          }
          whatsapp = checkedPhone.phone;
        }
        await requestCode(checkedEmail.email, whatsapp);
      }),
    [guard, emailInput, phoneInput, options.askPhone, requestCode],
  );

  const resend = useCallback(
    () =>
      guard(async () => {
        if (!email) return;
        await requestCode(email, phone);
      }),
    [guard, email, phone, requestCode],
  );

  const submitCode = useCallback(
    () =>
      guard(async () => {
        const checked = checkCode(codeInput);
        if ('problem' in checked) {
          setProblem(checked.problem);
          return;
        }
        if (!challenge) return;
        let result;
        try {
          result = await api.auth.verifyCode({
            body: { challengeId: challenge.challengeId, code: checked.code },
          });
        } catch (e) {
          // The code was right but the account could not be made: say what to fix, and go back.
          const noAccount = hasIssue(e, 'phone', 'phone_required');
          if (noAccount || hasIssue(e, 'phone', 'phone_in_use')) {
            setStep('email');
            setChallenge(null);
            setCodeInput('');
            setProblem(noAccount ? 'no_account' : 'phone_in_use');
            return;
          }
          throw e;
        }
        const { me, isNewAccount, ...tokens } = result;
        await auth.signIn(tokens, me);
        const preset = options.presetName ? checkName(options.presetName) : null;
        if ((isNewAccount || !me.displayName) && preset && 'name' in preset) {
          const named = await api.me.update({ body: { displayName: preset.name } });
          auth.setMe(named);
          setStep('done');
          onDoneRef.current();
        } else if (isNewAccount || !me.displayName) setStep('name');
        else {
          setStep('done');
          onDoneRef.current();
        }
      }),
    [guard, codeInput, challenge, api, auth, options.presetName],
  );

  const submitName = useCallback(
    () =>
      guard(async () => {
        const checked = checkName(nameInput);
        if ('problem' in checked) {
          setProblem(checked.problem);
          return;
        }
        const me = await api.me.update({ body: { displayName: checked.name } });
        auth.setMe(me);
        setStep('done');
        onDoneRef.current();
      }),
    [guard, nameInput, api, auth],
  );

  const skipName = useCallback(() => {
    setStep('done');
    onDoneRef.current();
  }, []);

  const changeEmail = useCallback(() => {
    setStep('email');
    setChallenge(null);
    setCodeInput('');
    setProblem(null);
    setError(undefined);
  }, []);

  return {
    step,
    emailInput,
    setEmailInput,
    email,
    phoneInput,
    setPhoneInput,
    codeInput,
    setCodeInput,
    nameInput,
    setNameInput,
    channel: challenge?.channel ?? null,
    working,
    problem,
    error,
    resendIn,
    submitEmail,
    submitCode,
    resend,
    submitName,
    skipName,
    changeEmail,
  };
}
