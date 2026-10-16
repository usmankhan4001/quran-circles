import { PostUpdateBody, type Principal } from '@qc/contracts';
import { emptyBilingual, isBilingualEmpty, toLocalizedOptional, type BilingualFields } from '../../lib/localized';
import type { MessageKey } from '../../i18n/translate';
import { canPostTo, type ScopeChoice, type VenueChoice } from './scopes';
import { fillTemplate, missingVariables, type TemplateChoice } from './templates';

export const TITLE_MAX = 500;
export const BODY_MAX = 4000;

export interface PostUpdateForm extends ScopeChoice {
  title: BilingualFields;
  body: BilingualFields;
  notify: boolean;
  templateKey: string | null;
  templateValues: Record<string, string>;
  /** Set when the update is about one session. */
  sessionId: string | null;
}

export type PostUpdateErrors = Partial<
  Record<'scope' | 'title' | 'body' | 'template', MessageKey>
>;

export const emptyPostUpdateForm = (choice: ScopeChoice, sessionId: string | null): PostUpdateForm => ({
  ...choice,
  title: emptyBilingual(),
  body: emptyBilingual(),
  notify: true,
  templateKey: null,
  templateValues: {},
  sessionId,
});

/** Applies a template to the body, in both languages. */
export function applyTemplate(form: PostUpdateForm, choice: TemplateChoice | null): PostUpdateForm {
  if (!choice) return { ...form, templateKey: null, templateValues: {} };
  const values = form.templateValues;
  return {
    ...form,
    templateKey: choice.key,
    body: {
      en: choice.en ? fillTemplate(choice.en, values) : '',
      ur: choice.ur ? fillTemplate(choice.ur, values) : '',
    },
  };
}

export interface ValidatedPost {
  errors: PostUpdateErrors;
  /** Present only when there are no errors. */
  body?: ReturnType<typeof PostUpdateBody.parse>;
}

/** Checks the form against the person's rights and the contract, and builds the request. */
export function validatePostUpdate(
  form: PostUpdateForm,
  principal: Principal,
  venues: readonly VenueChoice[],
  template: TemplateChoice | null,
): ValidatedPost {
  const errors: PostUpdateErrors = {};

  const venueCity = form.venueId ? (venues.find((v) => v.id === form.venueId)?.cityId ?? null) : null;
  const cityForCheck = form.level === 'venue' ? venueCity : form.cityId;
  if (!canPostTo(principal, form.level, cityForCheck, form.venueId)) {
    errors.scope = 'admin.postUpdate.error.scope';
  }

  if (isBilingualEmpty(form.title)) errors.title = 'admin.postUpdate.error.titleRequired';
  else if (form.title.en.length > TITLE_MAX || form.title.ur.length > TITLE_MAX) {
    errors.title = 'admin.postUpdate.error.titleLong';
  }

  if (isBilingualEmpty(form.body)) errors.body = 'admin.postUpdate.error.bodyRequired';
  else if (form.body.en.length > BODY_MAX || form.body.ur.length > BODY_MAX) {
    errors.body = 'admin.postUpdate.error.bodyLong';
  }

  if (template && missingVariables(template, form.templateValues).length > 0) {
    errors.template = 'admin.postUpdate.error.templateBlanks';
  }

  if (Object.keys(errors).length > 0) return { errors };

  const title = toLocalizedOptional(form.title);
  const body = toLocalizedOptional(form.body);
  const scope =
    form.level === 'national'
      ? ({ type: 'national' } as const)
      : form.level === 'city'
        ? ({ type: 'city', cityId: form.cityId ?? '' } as const)
        : ({ type: 'venue', venueId: form.venueId ?? '' } as const);
  const parsed = PostUpdateBody.safeParse({
    scope,
    kind: 'announcement',
    title,
    body,
    notify: form.notify,
    ...(form.sessionId ? { sessionId: form.sessionId } : {}),
    ...(form.templateKey ? { templateKey: form.templateKey } : {}),
  });
  if (!parsed.success) return { errors: { body: 'errors.validation_failed' } };
  return { errors, body: parsed.data };
}
