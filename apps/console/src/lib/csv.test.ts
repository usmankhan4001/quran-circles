import { describe, expect, it } from 'vitest';
import { detectDelimiter, mergeCsvParts, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('reads a header and data rows with their line numbers', () => {
    const t = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(t.header).toEqual(['a', 'b']);
    expect(t.records).toEqual([
      { line: 2, cells: ['1', '2'] },
      { line: 3, cells: ['3', '4'] },
    ]);
    expect(t.errors).toEqual([]);
  });

  it('handles quoted cells with delimiters, doubled quotes and line breaks', () => {
    const t = parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",z\n');
    expect(t.records[0]?.cells).toEqual(['x, y', 'say "hi"']);
    expect(t.records[1]).toEqual({ line: 3, cells: ['two\nlines', 'z'] });
    expect(t.errors).toEqual([]);
  });

  it('strips a byte order mark and skips blank lines', () => {
    const t = parseCsv('﻿a,b\n\n1,2\n   ,  \n');
    expect(t.header).toEqual(['a', 'b']);
    expect(t.records).toHaveLength(1);
  });

  it('detects semicolon and tab delimiters', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('"a;b",c\n')).toBe(',');
    expect(parseCsv('a;b\n1;2').records[0]?.cells).toEqual(['1', '2']);
  });

  it('reports an empty file', () => {
    expect(parseCsv('').errors).toEqual([{ code: 'empty_file', line: 0 }]);
    expect(parseCsv('  \n\n').errors).toEqual([{ code: 'empty_file', line: 0 }]);
  });

  it('reports an unterminated quote with the line it opened on', () => {
    const t = parseCsv('a,b\n1,"never closed\n3,4\n');
    expect(t.errors).toEqual([{ code: 'unterminated_quote', line: 2 }]);
  });

  it('reports a stray quote inside an unquoted cell', () => {
    const t = parseCsv('a,b\n1,ab"c\n');
    expect(t.errors).toEqual([{ code: 'stray_quote', line: 2 }]);
  });

  it('reports text after a closing quote', () => {
    expect(parseCsv('a,b\n"x"y,2\n').errors).toEqual([{ code: 'stray_quote', line: 2 }]);
  });

  it('refuses files with too many rows or too many characters', () => {
    const rows = Array.from({ length: 5 }, (_, i) => String(i)).join('\n');
    const t = parseCsv(`n\n${rows}`, { maxRows: 3 });
    expect(t.errors).toEqual([{ code: 'too_many_rows', line: 0 }]);
    expect(t.records).toHaveLength(3);
    expect(parseCsv('abcdef', { maxChars: 3 }).errors).toEqual([
      { code: 'file_too_large', line: 0 },
    ]);
  });

  it('keeps Urdu text intact', () => {
    const t = parseCsv('name\nمسجد النور\n');
    expect(t.records[0]?.cells[0]).toBe('مسجد النور');
  });
});

describe('toCsv and mergeCsvParts', () => {
  it('quotes only what needs quotes and round-trips', () => {
    const rows = [
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['two\nlines', ' padded '],
    ];
    const text = toCsv(rows);
    expect(text.endsWith('\r\n')).toBe(true);
    const back = parseCsv(text);
    expect([back.header, ...back.records.map((r) => r.cells)]).toEqual(rows);
  });

  it('merges exports by header name and adds the session column first', () => {
    const merged = mergeCsvParts([
      { key: 's1', csv: 'name,phone\r\nA,1\r\n' },
      { key: 's2', csv: 'phone,name,extra\r\n2,B,x\r\n' },
    ]);
    expect(merged).not.toBeNull();
    const t = parseCsv(merged as string);
    expect(t.header).toEqual(['session_id', 'name', 'phone', 'extra']);
    expect(t.records.map((r) => r.cells)).toEqual([
      ['s1', 'A', '1', ''],
      ['s2', 'B', '2', 'x'],
    ]);
  });

  it('returns null when one part is unreadable, so nothing is silently dropped', () => {
    expect(
      mergeCsvParts([
        { key: 's1', csv: 'a\n1\n' },
        { key: 's2', csv: 'a\n"open\n' },
      ]),
    ).toBeNull();
  });
});
