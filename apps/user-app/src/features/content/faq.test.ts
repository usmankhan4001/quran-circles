import { describe, expect, it } from 'vitest';
import { parseHelpBody } from './faq';

describe('parseHelpBody', () => {
  it('reads a question and the paragraphs under it as one item', () => {
    const body = parseHelpBody(
      [
        'Answers to common questions.',
        'Do I need an account?',
        'No. You can browse without one.',
        'You only sign in to join.',
        'How do I stop reminders?',
        'Open Profile, then Alerts.',
      ].join('\n\n'),
    );
    expect(body.intro).toEqual(['Answers to common questions.']);
    expect(body.items).toEqual([
      {
        question: 'Do I need an account?',
        answer: ['No. You can browse without one.', 'You only sign in to join.'],
      },
      { question: 'How do I stop reminders?', answer: ['Open Profile, then Alerts.'] },
    ]);
  });

  it('knows the Urdu question mark', () => {
    const body = parseHelpBody('کیا مجھے اکاؤنٹ چاہیے؟\n\nنہیں۔');
    expect(body.items).toEqual([{ question: 'کیا مجھے اکاؤنٹ چاہیے؟', answer: ['نہیں۔'] }]);
    expect(body.intro).toEqual([]);
  });

  it('keeps a page without questions as plain paragraphs', () => {
    const body = parseHelpBody('Quran Circles is free.\n\nIt is built on the work of others.');
    expect(body.items).toEqual([]);
    expect(body.intro).toEqual(['Quran Circles is free.', 'It is built on the work of others.']);
  });

  it('does not lose a question that has no answer under it', () => {
    const body = parseHelpBody('Is it free?\n\nCan I bring family?\n\nYes.');
    expect(body.intro).toEqual(['Is it free?']);
    expect(body.items).toEqual([{ question: 'Can I bring family?', answer: ['Yes.'] }]);
    const last = parseHelpBody('Intro text.\n\nStill here?');
    expect(last.items).toEqual([]);
    expect(last.intro).toEqual(['Intro text.', 'Still here?']);
  });

  it('treats a multi-line paragraph that ends in a question mark as text', () => {
    const body = parseHelpBody('First line\nWhat now?\n\nAnother paragraph.');
    expect(body.items).toEqual([]);
    expect(body.intro).toEqual(['First line\nWhat now?', 'Another paragraph.']);
  });

  it('copes with empty text and extra blank lines', () => {
    expect(parseHelpBody('')).toEqual({ intro: [], items: [] });
    expect(parseHelpBody('\n\n  \n\nOnly this.\n\n\n')).toEqual({
      intro: ['Only this.'],
      items: [],
    });
  });
});
