/**
 * Structured logging with personal-data redaction. Phone numbers, names, message bodies, codes and
 * tokens are never written. Fields whose key looks personal are replaced, and so is any string
 * value that looks like a phone number. Log ids and codes, not content.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

const PERSONAL_KEY =
  /(phone|name|token|authorization|cookie|password|secret|otp|body|message|address|email|^code$|^q$|note|title|label|text)/i;
const PHONE_LIKE = /\+?[0-9][0-9 ()-]{7,}[0-9]/;
const REDACTED = '[redacted]';

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return PHONE_LIKE.test(value) ? REDACTED : value;
  if (typeof value !== 'object') return value;
  if (depth > 4) return REDACTED;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = PERSONAL_KEY.test(key) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(
  sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  minLevel: LogLevel = 'info',
): Logger {
  const write = (level: LogLevel, msg: string, fields?: LogFields) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    sink(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        msg,
        ...(fields ? (redact(fields) as LogFields) : {}),
      }),
    );
  };
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
  };
}

export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
