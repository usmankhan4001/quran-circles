/**
 * Minimal RFC 4180 CSV reading and writing, with a guard against spreadsheet formula injection.
 *
 * V1 let anyone insert venues (the table accepted inserts from every visitor), so text copied
 * from V1 into a CSV that the owner opens in a spreadsheet must not be able to run as a formula.
 */

/** Parses CSV text into rows of cells. Handles quotes, doubled quotes, CRLF and a leading BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let sawAny = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    sawAny = true;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (inQuotes) throw new Error('CSV ends inside a quoted cell');
  if (sawAny && (cell !== '' || row.length > 0)) endRow();

  // Blank lines carry no data.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export class CsvShapeError extends Error {
  override name = 'CsvShapeError';
}

/**
 * Parses CSV with a header row into objects. Header names are trimmed and lower-cased. Every
 * data row must have exactly as many cells as the header.
 */
export function parseCsvObjects(input: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(input);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((cells, index) => {
    if (cells.length !== keys.length) {
      throw new CsvShapeError(
        `CSV row ${index + 2} has ${cells.length} cells but the header has ${keys.length}`,
      );
    }
    const record: Record<string, string> = {};
    keys.forEach((key, i) => {
      record[key] = cells[i]!;
    });
    return record;
  });
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** Prefixes a quote so a spreadsheet shows the cell as text instead of running it. */
export function guardCell(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** Undoes `guardCell` for a value that was written by this tool and edited by a person. */
export function unguardCell(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

function quoteCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Formats rows as CSV with LF line endings. Cells are written as given; guard them first. */
export function formatCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(quoteCell).join(',')).join('\n') + '\n';
}
