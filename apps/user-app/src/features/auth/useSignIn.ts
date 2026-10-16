import { useCallback, useEffect, useRef, useState } from 'react';
import type { OtpChannel } from '@qc/contracts';
import { toAppError, type AppError } from '../../core/errors';
import { useI18n } from '../../i18n/I18nProvider';
import { useServices } from '../../providers/services';
import { checkCode, checkName, checkPhone, type FieldProblem } from './validation';

export type SignInStep = 'phone' | 'code' | 'name' | 'done';

interface Challenge {
  challengeId: string;
  channel: OtpChannel;
  /** When the next code may be asked for, in milliseconds since 1970. */
  resendAt: number;
}

export interface SignInFlow {
  step: SignInStep;
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
  submitPhone: () => Promise<void>;
  submitCode: () => Promise<void>;
  resend: (channel: OtpChannel) => Promise<void>;
  submitName: () => Promise<void>;
  skipName: () => void;
  changeNumber: () => void;
}

/** Seconds from `now` until `target`, rounded up, never negative. */
export function secondsUntil(target: number, now: number): number {
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/**
 * Phone, then the code from WhatsApp (SMS as a fallback), then, for a new account, a name.
 * The screen only draws this; every rule is here and in `validation.ts`.
 */
export function useSignIn(onDone: () => void): SignInFlow {
  const { api, auth, now } = useServices();
  const { locale } = useI18n();
  const [step, setStep] = useState<SignInStep>('phone');
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
    async (target: string, channel: OtpChannel) => {
      const response = await api.auth.requestCode({ body: { phone: target, locale, channel } });
      setPhone(target);
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

  const submitPhone = useCallback(
    () =>
      guard(async () => {
        const checked = checkPhone(phoneInput);
        if ('problem' in checked) {
          setProblem(checked.problem);
          return;
        }
        await requestCode(checked.phone, 'whatsapp');
      }),
    [guard, phoneInput, requestCode],
  );

  const resend = useCallback(
    (channel: OtpChannel) =>
      guard(async () => {
        if (!phone) return;
        await requestCode(phone, channel);
      }),
    [guard, phone, requestCode],
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
        const result = await api.auth.verifyCode({
          body: { challengeId: challenge.challengeId, code: checked.code },
        });
        const { me, isNewAccount, ...tokens } = result;
        await auth.signIn(tokens, me);
        if (isNewAccount || !me.displayName) setStep('name');
        else {
          setStep('done');
          onDoneRef.current();
        }
      }),
    [guard, codeInput, challenge, api, auth],
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

  const changeNumber = useCallback(() => {
    setStep('phone');
    setChallenge(null);
    setCodeInput('');
    setProblem(null);
    setError(undefined);
  }, []);

  return {
    step,
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
    submitPhone,
    submitCode,
    resend,
    submitName,
    skipName,
    changeNumber,
  };
}
