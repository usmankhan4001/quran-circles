import { describe, expect, it } from 'vitest';
import { fillTemplate, groupTemplates, missingVariables, type TemplateViewLike } from './templates';

const item = (over: Partial<TemplateViewLike>): TemplateViewLike => ({
  key: 'time_change',
  channel: 'push',
  locale: 'en',
  body: 'The session now starts at {time}.',
  variables: ['time'],
  status: 'approved',
  ...over,
});

describe('groupTemplates', () => {
  it('joins English and Urdu wording under one key', () => {
    const groups = groupTemplates([
      item({}),
      item({ locale: 'ur', body: 'سیشن اب {time} بجے شروع ہوگا۔' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: 'time_change',
      en: 'The session now starts at {time}.',
      variables: ['time'],
    });
    expect(groups[0]!.ur).toContain('{time}');
  });

  it('leaves out templates that are not approved', () => {
    expect(
      groupTemplates([item({ status: 'draft' }), item({ key: 'other', status: 'rejected' })]),
    ).toEqual([]);
  });

  it('does not ask for the link, which the system adds', () => {
    const [g] = groupTemplates([
      item({ key: 'reminder', body: 'See you at {venue}. {link}', variables: ['venue', 'link'] }),
    ]);
    expect(g!.variables).toEqual(['venue']);
  });

  it('prefers push wording over WhatsApp wording', () => {
    const [g] = groupTemplates([
      item({ channel: 'whatsapp', body: 'WhatsApp wording' }),
      item({ channel: 'push', body: 'Push wording' }),
    ]);
    expect(g!.en).toBe('Push wording');
  });

  it('does not repeat a variable', () => {
    const [g] = groupTemplates([item({}), item({ locale: 'ur', body: 'ur {time}' })]);
    expect(g!.variables).toEqual(['time']);
  });
});

describe('fillTemplate', () => {
  it('fills the blanks', () => {
    expect(fillTemplate('Starts at {time}.', { time: '7:30 pm' })).toBe('Starts at 7:30 pm.');
  });

  it('drops the link and the space before it when the system fills it later', () => {
    expect(fillTemplate('See you at {venue} {link}', { venue: 'Al-Noor' })).toBe(
      'See you at Al-Noor',
    );
    expect(fillTemplate('See you at {venue} {link}.', { venue: 'Al-Noor' })).toBe(
      'See you at Al-Noor.',
    );
  });

  it('keeps an empty blank visible so it cannot be missed', () => {
    expect(fillTemplate('Starts at {time}.', {})).toBe('Starts at {time}.');
    expect(fillTemplate('Starts at {time}.', { time: '   ' })).toBe('Starts at {time}.');
  });

  it('closes up the space before Urdu punctuation', () => {
    expect(fillTemplate('سیشن {time} ۔', { time: '7:30' })).toBe('سیشن 7:30۔');
  });
});

describe('missingVariables', () => {
  const choice = { key: 'k', en: 'a', ur: null, variables: ['time', 'venue'] };
  it('lists the blanks still empty', () => {
    expect(missingVariables(choice, { time: '7:30' })).toEqual(['venue']);
    expect(missingVariables(choice, { time: '7:30', venue: ' x ' })).toEqual([]);
    expect(missingVariables(choice, {})).toEqual(['time', 'venue']);
  });
});
