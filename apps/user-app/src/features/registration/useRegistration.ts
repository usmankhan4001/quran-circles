import { useCallback, useState } from 'react';
import type { Registration, Session } from '@qc/contracts';
import { useAction } from '../../data/useAction';
import { needsSignIn, type AppError } from '../../core/errors';
import { usePreferences } from '../../providers/hooks';
import { useServices } from '../../providers/services';
import {
  buildRegistration,
  initialForm,
  validateRegistration,
  type RegistrationForm,
  type RegistrationProblems,
} from './form';

export interface RegistrationFlow {
  form: RegistrationForm;
  setForm: (change: Partial<RegistrationForm>) => void;
  /** Problems shown under fields. Empty until the person has tried to send. */
  problems: RegistrationProblems;
  needsName: boolean;
  submit: () => Promise<void>;
  submitting: boolean;
  error: AppError | undefined;
  result: Registration | null;
  /** True when the failure means the person must sign in again. */
  signInRequired: boolean;
}

/** The registration form: fields, checks, the call and its outcome. Drawn by `RegistrationScreen`. */
export function useRegistration(input: {
  session: Session;
  occurrenceId?: string;
  displayName: string | null;
}): RegistrationFlow {
  const { api, cache, preferences } = useServices();
  const prefs = usePreferences();
  const needsName = !input.displayName;
  const [form, setFormState] = useState<RegistrationForm>(() =>
    initialForm({
      session: input.session,
      displayName: input.displayName,
      cityId: prefs.cityId,
      areaId: prefs.areaId,
    }),
  );
  const [problems, setProblems] = useState<RegistrationProblems>({});
  const [result, setResult] = useState<Registration | null>(null);
  const options = {
    sessionId: input.session.id,
    ...(input.occurrenceId ? { occurrenceId: input.occurrenceId } : {}),
    needsName,
    session: input.session,
  };

  const setForm = useCallback((change: Partial<RegistrationForm>) => {
    setFormState((current) => ({ ...current, ...change }));
    // Editing a field clears its own problem.
    setProblems((current) => {
      const next = { ...current };
      if ('name' in change) delete next.name;
      if ('areaId' in change) delete next.area;
      if ('section' in change) delete next.section;
      if ('partySize' in change) delete next.partySize;
      return next;
    });
  }, []);

  const send = useAction(async () => {
    const body = buildRegistration(form, options);
    if (!body) throw new Error('The form is not valid');
    const registration = await api.registrations.create({ body });
    // The person's own lists are out of date now; the area becomes their default.
    cache.invalidate('me:');
    void preferences.update({ areaId: form.areaId, cityId: form.cityId });
    setResult(registration);
    return registration;
  });

  const submit = useCallback(async () => {
    const found = validateRegistration(form, options);
    if (Object.keys(found).length > 0) {
      setProblems(found);
      return;
    }
    await send.run();
  }, [form, send, needsName, input.session]);

  return {
    form,
    setForm,
    problems,
    needsName,
    submit,
    submitting: send.running,
    error: send.error,
    result,
    signInRequired: send.error ? needsSignIn(send.error.code) : false,
  };
}
