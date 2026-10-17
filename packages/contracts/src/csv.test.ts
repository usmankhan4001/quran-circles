import { describe, expect, it } from 'vitest';
import { csvCell, csvFile, csvLine } from './csv';

describe('csvCell', () => {
  it('writes plain values as they are', () => {
    expect(csvCell('Ayesha Khan')).toBe('Ayesha Khan');
    expect(csvCell(3)).toBe('3');
    expect(csvCell(true)).toBe('true');
  });

  it('writes nothing for null and undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes cells with a comma, a quote or a line break, and doubles quotes', () => {
    expect(csvCell('Khan, Ayesha')).toBe('"Khan, Ayesha"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell('two\r\nlines')).toBe('"two\r\nlines"');
  });

  it.each(['=1+1', '+923001234567', '-5', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'neutralises a formula start in text from people: %j',
    (value) => {
      expect(csvCell(value).replaceAll('"', '').startsWith("'")).toBe(true);
    },
  );

  it('keeps trusted values, such as a phone number, exactly as they are', () => {
    expect(csvCell('+923001234567', { trusted: true })).toBe('+923001234567');
  });

  it('neutralises before quoting, so a quoted formula cannot run either', () => {
    expect(csvCell('=HYPERLINK("x","y"),z')).toBe('"\'=HYPERLINK(""x"",""y""),z"');
  });

  it('does not touch Urdu or a dash that is not first', () => {
    expect(csvCell('عائشہ خان')).toBe('عائشہ خان');
    expect(csvCell('Al-Noor')).toBe('Al-Noor');
  });

  it('never changes numbers, even negative ones', () => {
    expect(csvCell(-5)).toBe('-5');
  });
});

describe('csvFile', () => {
  it('writes the header and the lines with CRLF line ends and no byte order mark', () => {
    const file = csvFile(['name', 'party_size'], [csvLine([csvCell('A'), csvCell(2)])]);
    expect(file).toBe('name,party_size\r\nA,2\r\n');
    expect(file.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('writes just the header when there are no rows', () => {
    expect(csvFile(['a', 'b'], [])).toBe('a,b\r\n');
  });
});
