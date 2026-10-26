import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { creditGroups, creditLinks, fonts, urduFallbackFont } from './index';

const en = messages.en as Record<string, string>;
const ur = messages.ur as Record<string, string>;
const entries = creditGroups.flatMap((g) => g.entries);

describe('credits', () => {
  it('credits each bundled font, the Quran text and both translations', () => {
    expect(entries.map((e) => e.id)).toEqual([
      'jakarta',
      'jameel',
      'mehr',
      'kfgqpc',
      'tanzil',
      'translationUr',
      'translationEn',
    ]);
    expect(en['credits.jakarta.name']).toBe(fonts.sans);
    expect(en['credits.jameel.name']).toBe(fonts.urdu);
    expect(en['credits.mehr.name']).toBe(urduFallbackFont);
    expect(en['credits.kfgqpc.name']).toBe(fonts.quran);
  });

  it('has words for every key in English and Urdu', () => {
    const keys = creditGroups.flatMap((g) => [
      g.heading,
      ...g.entries.flatMap((e) => [e.name, e.body, ...(e.link ? [e.link.label] : [])]),
    ]);
    for (const key of keys) {
      expect(en[key], key).toBeTruthy();
      expect(ur[key], key).toBeTruthy();
    }
    expect(ur['_credits.status']).toMatch(/Draft/);
  });

  it('names the licences and the people the owner asked for', () => {
    expect(en['credits.jakarta.body']).toContain('SIL Open Font License 1.1');
    expect(en['credits.mehr.body']).toMatch(
      /Mehr Type.*CSaLT.*Information Technology University of the Punjab.*CC BY-SA 4\.0/,
    );
    expect(en['credits.kfgqpc.body']).toContain("King Fahd Glorious Qur'an Printing Complex");
    expect(en['credits.tanzil.name']).toContain('Tanzil Project');
    expect(en['credits.translationUr.body']).toMatch(/Maududi.*Tafhim al-Qur'an/);
    expect(en['credits.translationEn.body']).toMatch(
      /Maududi.*Towards Understanding the Qur'an.*Zafar Ishaq Ansari/,
    );
  });

  it('links the CC BY-SA licence and tanzil.net over https', () => {
    const urls = entries.flatMap((e) => (e.link ? [e.link.url] : []));
    expect(urls).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(urls).toContain('https://tanzil.net');
    for (const url of Object.values(creditLinks)) expect(url).toMatch(/^https:\/\//);
  });
});
