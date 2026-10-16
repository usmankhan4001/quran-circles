import {
  PersonName,
  SECTIONS,
  type RegistrationCreate,
  type Section,
  type Session,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';

export const MAX_PARTY_SIZE = 20;

export interface RegistrationForm {
  name: string;
  cityId: string | null;
  areaId: string | null;
  section: Section | null;
  partySize: number;
  /** The consent checkbox for WhatsApp alerts about this session. Off until the person ticks it. */
  allowWhatsapp: boolean;
}

export type RegistrationField = 'name' | 'area' | 'section' | 'partySize';
export type RegistrationProblems = Partial<Record<RegistrationField, MessageKey>>;

/**
 * Which sections a person can register in. A women's or men's session has only its own
 * section; a family session welcomes any of the three.
 */
export function allowedSections(session: Pick<Session, 'section'>): Section[] {
  return session.section === 'family' ? [...SECTIONS] : [session.section];
}

export function initialForm(input: {
  session: Pick<Session, 'section' | 'cityId'>;
  displayName: string | null;
  cityId: string | null;
  areaId: string | null;
}): RegistrationForm {
  const sections = allowedSections(input.session);
  return {
    name: input.displayName ?? '',
    cityId: input.cityId ?? input.session.cityId,
    areaId: input.areaId,
    section: sections.length === 1 ? (sections[0] ?? null) : null,
    partySize: 1,
    allowWhatsapp: false,
  };
}

/** Problems with the form, as message keys. Empty means it can be sent. */
export function validateRegistration(
  form: RegistrationForm,
  options: { needsName: boolean; session: Pick<Session, 'section'> },
): RegistrationProblems {
  const problems: RegistrationProblems = {};
  if (options.needsName && !PersonName.safeParse(form.name).success) {
    problems.name = 'registration.name.error';
  }
  if (!form.areaId) problems.area = 'registration.area.error';
  if (!form.section || !allowedSections(options.session).includes(form.section)) {
    problems.section = 'registration.problem.section';
  }
  if (!Number.isInteger(form.partySize) || form.partySize < 1 || form.partySize > MAX_PARTY_SIZE) {
    problems.partySize = 'registration.problem.partySize';
  }
  return problems;
}

/** The request body, or null while the form still has problems. */
export function buildRegistration(
  form: RegistrationForm,
  options: {
    sessionId: string;
    occurrenceId?: string;
    needsName: boolean;
    session: Pick<Session, 'section'>;
  },
): RegistrationCreate | null {
  if (Object.keys(validateRegistration(form, options)).length > 0) return null;
  if (!form.areaId || !form.section) return null;
  return {
    sessionId: options.sessionId,
    ...(options.occurrenceId ? { occurrenceId: options.occurrenceId } : {}),
    areaId: form.areaId,
    section: form.section,
    partySize: form.partySize,
    ...(options.needsName ? { name: form.name.trim() } : {}),
    allowWhatsapp: form.allowWhatsapp,
  };
}

/** The server may answer a full session with a waitlist place instead of an error. */
export function isWaitlisted(registration: { status: string }): boolean {
  return registration.status === 'waitlisted';
}
