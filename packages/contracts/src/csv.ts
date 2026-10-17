/**
 * Small CSV writer shared by every export, so the rules live in one place.
 * Output is UTF-8 text with `\r\n` line ends and no byte order mark (the console adds one when it
 * saves the file, so spreadsheets read Urdu correctly).
 */

/** Cells that start with one of these are run as formulas by spreadsheets. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One cell. Text from people (names) is neutralised: a leading `=`, `+`, `-`, `@`, tab or CR gets
 * an apostrophe in front, so it shows as text instead of running. Pass `{ trusted: true }` for
 * values the server made itself, such as an E.164 phone number or an id. Cells with a comma,
 * quote or line break are quoted.
 */
export function csvCell(
  value: string | number | boolean | null | undefined,
  options: { trusted?: boolean } = {},
): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (!options.trusted && typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One line of cells, without the line end. Cells are already written by `csvCell`. */
export const csvLine = (cells: readonly string[]): string => cells.join(',');

/** A whole file: the header, then the lines, each ending in `\r\n`. */
export const csvFile = (header: readonly string[], lines: readonly string[]): string =>
  [csvLine(header), ...lines].map((line) => `${line}\r\n`).join('');
