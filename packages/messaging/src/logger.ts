/**
 * Structured logging that cannot leak personal data by construction. Every logger goes through
 * `sanitizeFields`, which drops fields named like personal data and redacts phone-number-shaped
 * strings. Callers should still log only ids and enums; this is the safety net, not the plan.
 */
export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const FORBIDDEN_KEY_PARTS = [
  'phone',
  'token',
  'secret',
  'password',
  'authorization',
  'variables',
  'payload',
  'displayname',
  'apikey',
  'privatekey',
];
const FORBIDDEN_EXACT_KEYS = new Set([
  'to',
  'from',
  'name',
  'code',
  'otp',
  'text',
  'body',
  'title',
  'link',
  'wa_id',
  'waid',
]);

const PHONE_SHAPE = /\+?\d[\d\s-]{7,}\d/;

export function sanitizeFields(fields: LogFields | undefined): LogFields {
  const out: LogFields = {};
  if (!fields) return out;
  for (const [key, value] of Object.entries(fields)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_EXACT_KEYS.has(lower) || FORBIDDEN_KEY_PARTS.some((p) => lower.includes(p))) {
      continue;
    }
    if (typeof value === 'string' && PHONE_SHAPE.test(value)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = value;
  }
  return out;
}

export interface LogLine {
  level: LogLevel;
  event: string;
  fields: LogFields;
}

/** Builds a logger around a sink. Fields are sanitized before the sink sees them. */
export function createLogger(sink: (line: LogLine) => void): Logger {
  const make =
    (level: LogLevel) =>
    (event: string, fields?: LogFields): void =>
      sink({ level, event, fields: sanitizeFields(fields) });
  return { debug: make('debug'), info: make('info'), warn: make('warn'), error: make('error') };
}

/** JSON lines on stdout. */
export function createConsoleLogger(write: (line: string) => void = console.log): Logger {
  return createLogger((line) => write(JSON.stringify({ t: new Date().toISOString(), ...line })));
}

export interface MemoryLogger extends Logger {
  readonly lines: LogLine[];
  /** Every line as one JSON string, for assertions that nothing sensitive leaked. */
  dump(): string;
}

/** Captures log lines in memory. Used by tests. */
export function createMemoryLogger(): MemoryLogger {
  const lines: LogLine[] = [];
  const logger = createLogger((line) => lines.push(line));
  return { ...logger, lines, dump: () => lines.map((l) => JSON.stringify(l)).join('\n') };
}

export const silentLogger: Logger = createLogger(() => {});
