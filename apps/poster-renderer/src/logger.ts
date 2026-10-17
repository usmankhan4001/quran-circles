/**
 * A small structured logger. The renderer logs event names, ids, sizes and durations only: never
 * poster text, venue names, titles or anything a person typed.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export function createConsoleLogger(): Logger {
  const write =
    (level: 'info' | 'warn' | 'error') =>
    (event: string, fields: LogFields = {}): void => {
      const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
      if (level === 'error') console.error(line);
      else console.log(line);
    };
  return { info: write('info'), warn: write('warn'), error: write('error') };
}

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
