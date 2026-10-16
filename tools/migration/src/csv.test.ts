import { describe, expect, it } from 'vitest';
import { CsvShapeError, formatCsv, guardCell, parseCsv, parseCsvObjects, unguardCell } from './csv';

describe('parseCsv', () => {
  it('reads plain rows, with LF or CRLF or CR endings', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('reads quoted cells with commas, quotes and newlines', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n"line1\nline2",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['line1\nline2', 'z'],
    ]);
  });
  it('keeps empty cells and drops blank lines', () => {
    expect(parseCsv('a,b,c\n\n,,\n')).toEqual([
      ['a', 'b', 'c'],
      ['', '', ''],
    ]);
  });
  it('strips a byte order mark', () => {
    expect(parseCsv('\ufeffa,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('rejects a quote that never closes', () => {
    expect(() => parseCsv('a\n"oops')).toThrow('quoted');
  });
  it('reads Urdu text intact', () => {
    expect(parseCsv('نام,شہر\nمسجد,لاہور')[1]).toEqual(['مسجد', 'لاہور']);
  });
});

describe('parseCsvObjects', () => {
  it('keys cells by trimmed lower-case header', () => {
    expect(parseCsvObjects(' V1_ID ,City_Slug\n1,lahore')).toEqual([
      { v1_id: '1', city_slug: 'lahore' },
    ]);
  });
  it('rejects a row with the wrong number of cells', () => {
    expect(() => parseCsvObjects('a,b\n1')).toThrow(CsvShapeError);
  });
  it('returns nothing for an empty file', () => {
    expect(parseCsvObjects('')).toEqual([]);
  });
});

describe('formatCsv', () => {
  it('round-trips awkward cells', () => {
    const rows = [['a', 'b,c', 'say "x"', 'two\nlines', '', 'نام']];
    expect(parseCsv(formatCsv(rows))).toEqual(rows);
  });
});

describe('formula injection guard', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\tx', '\rx'])('guards %j', (value) => {
    const guarded = guardCell(value);
    expect(guarded.startsWith("'")).toBe(true);
    expect(unguardCell(guarded)).toBe(value);
  });
  it('leaves ordinary text alone, and does not strip a real leading apostrophe', () => {
    expect(guardCell('Sample Masjid')).toBe('Sample Masjid');
    expect(unguardCell("'Alif")).toBe("'Alif");
    expect(unguardCell('Sample')).toBe('Sample');
  });
});
