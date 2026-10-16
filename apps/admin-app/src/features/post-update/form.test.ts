import { describe, expect, it } from 'vitest';
import { ids, meFor } from '../../test/backend';
import { principalOf } from '../../scope/principal';
import {
  BODY_MAX,
  TITLE_MAX,
  applyTemplate,
  emptyPostUpdateForm,
  validatePostUpdate,
  type PostUpdateForm,
} from './form';

const venues = [
  { id: ids.venueAlNoor, cityId: ids.cityRawalpindi, label: 'Al-Noor' },
  { id: ids.venueLahore, cityId: ids.cityLahore, label: 'Bilal' },
];

const venueForm = (patch: Partial<PostUpdateForm> = {}): PostUpdateForm => ({
  ...emptyPostUpdateForm({ level: 'venue', cityId: null, venueId: ids.venueAlNoor }, null),
  title: { en: 'Sample title', ur: '' },
  body: { en: 'Sample body', ur: '' },
  ...patch,
});

describe('validatePostUpdate', () => {
  it('builds a venue update with the notify choice', () => {
    const { errors, body } = validatePostUpdate(
      venueForm(),
      principalOf(meFor('venue')),
      venues,
      null,
    );
    expect(errors).toEqual({});
    expect(body).toMatchObject({
      scope: { type: 'venue', venueId: ids.venueAlNoor },
      kind: 'announcement',
      title: { en: 'Sample title' },
      body: { en: 'Sample body' },
      notify: true,
    });
    expect(body).not.toHaveProperty('sessionId');
  });

  it('sends notify off and the session it is about', () => {
    const sessionId = '00000000-0000-4000-8000-020000000001';
    const { body } = validatePostUpdate(
      venueForm({ notify: false, sessionId }),
      principalOf(meFor('venue')),
      venues,
      null,
    );
    expect(body).toMatchObject({ notify: false, sessionId });
  });

  it('builds a city and a national update for the roles that may post them', () => {
    const city = validatePostUpdate(
      venueForm({ level: 'city', cityId: ids.cityRawalpindi, venueId: null }),
      principalOf(meFor('city')),
      venues,
      null,
    );
    expect(city.body?.scope).toEqual({ type: 'city', cityId: ids.cityRawalpindi });
    const national = validatePostUpdate(
      venueForm({ level: 'national', cityId: null, venueId: null }),
      principalOf(meFor('admin')),
      venues,
      null,
    );
    expect(national.body?.scope).toEqual({ type: 'national' });
  });

  it('refuses a scope the role may not post to', () => {
    const venue = validatePostUpdate(
      venueForm({ venueId: ids.venueLahore }),
      principalOf(meFor('venue')),
      venues,
      null,
    );
    expect(venue.errors.scope).toBe('admin.postUpdate.error.scope');
    expect(venue.body).toBeUndefined();

    const city = validatePostUpdate(
      venueForm({ level: 'city', cityId: ids.cityRawalpindi, venueId: null }),
      principalOf(meFor('venue')),
      venues,
      null,
    );
    expect(city.errors.scope).toBe('admin.postUpdate.error.scope');

    const national = validatePostUpdate(
      venueForm({ level: 'national', cityId: null, venueId: null }),
      principalOf(meFor('city')),
      venues,
      null,
    );
    expect(national.errors.scope).toBe('admin.postUpdate.error.scope');
  });

  it('asks for a title and a body', () => {
    const { errors } = validatePostUpdate(
      venueForm({ title: { en: '', ur: '' }, body: { en: ' ', ur: '' } }),
      principalOf(meFor('venue')),
      venues,
      null,
    );
    expect(errors.title).toBe('admin.postUpdate.error.titleRequired');
    expect(errors.body).toBe('admin.postUpdate.body.error');
  });

  it('refuses text that is too long', () => {
    const { errors } = validatePostUpdate(
      venueForm({
        title: { en: 'x'.repeat(TITLE_MAX + 1), ur: '' },
        body: { en: 'x'.repeat(BODY_MAX + 1), ur: '' },
      }),
      principalOf(meFor('venue')),
      venues,
      null,
    );
    expect(errors.title).toBe('admin.postUpdate.error.titleLong');
    expect(errors.body).toBe('admin.postUpdate.error.bodyLong');
  });

  it('copes with Urdu-only text', () => {
    const { body } = validatePostUpdate(
      venueForm({ title: { en: '', ur: 'عنوان' }, body: { en: '', ur: 'متن' } }),
      principalOf(meFor('venue')),
      venues,
      null,
    );
    expect(body?.title).toEqual({ en: 'عنوان', ur: 'عنوان' });
  });

  it('refuses a template with blanks left empty and sends the key when filled', () => {
    const template = { key: 'time_change', en: 'Starts at {time}', ur: null, variables: ['time'] };
    const blank = validatePostUpdate(
      venueForm({ templateKey: 'time_change', templateValues: {} }),
      principalOf(meFor('venue')),
      venues,
      template,
    );
    expect(blank.errors.template).toBe('admin.postUpdate.error.templateBlanks');
    const ready = validatePostUpdate(
      venueForm({ templateKey: 'time_change', templateValues: { time: '7:30 pm' } }),
      principalOf(meFor('venue')),
      venues,
      template,
    );
    expect(ready.body).toMatchObject({ templateKey: 'time_change' });
  });
});

describe('applyTemplate', () => {
  const template = {
    key: 'time_change',
    en: 'Starts at {time}.',
    ur: 'اب {time} بجے۔',
    variables: ['time'],
  };

  it('fills the body in both languages', () => {
    const form = applyTemplate({ ...venueForm(), templateValues: { time: '7:30 pm' } }, template);
    expect(form.templateKey).toBe('time_change');
    expect(form.body).toEqual({ en: 'Starts at 7:30 pm.', ur: 'اب 7:30 pm بجے۔' });
  });

  it('keeps the blank visible until it is filled', () => {
    expect(applyTemplate(venueForm(), template).body.en).toBe('Starts at {time}.');
  });

  it('clears the template choice', () => {
    const form = applyTemplate(
      { ...venueForm(), templateKey: 'time_change', templateValues: { time: 'x' } },
      null,
    );
    expect(form.templateKey).toBeNull();
    expect(form.templateValues).toEqual({});
  });
});
