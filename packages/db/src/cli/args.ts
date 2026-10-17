export interface RollbackArgs {
  steps?: number;
  all: boolean;
}

const USAGE = 'Usage: rollback [--all | --steps N]   (default: roll back one migration)';

/** Parses `--all`, `--steps N` and `--steps=N`. Throws with a usage line on anything else. */
export function parseRollbackArgs(argv: readonly string[]): RollbackArgs {
  let all = false;
  let steps: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') continue;
    if (arg === '--all') {
      all = true;
    } else if (arg === '--steps' || arg === '-n' || arg.startsWith('--steps=')) {
      const raw = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      const value = Number(raw);
      if (raw === undefined || raw === '' || !Number.isInteger(value) || value < 1) {
        throw new Error(`--steps needs a whole number of at least 1. ${USAGE}`);
      }
      steps = value;
    } else {
      throw new Error(`Unknown argument "${arg}". ${USAGE}`);
    }
  }
  if (all && steps !== undefined) throw new Error(`Use --all or --steps, not both. ${USAGE}`);
  return steps === undefined ? { all } : { all, steps };
}

export interface SeedArgs {
  /** The week to move the fixture dates to; `null` keeps the fixture dates (February 2027). */
  anchor: Date | null;
}

const SEED_USAGE =
  'Usage: seed [--anchor YYYY-MM-DD | --anchor <ISO instant> | --fixture-dates]   (default: anchor on today)';

/**
 * Parses `--anchor D`, `--anchor=D` and `--fixture-dates`. Without either, the anchor is `now`,
 * so a database seeded today has sessions this week. Throws with a usage line on anything else.
 */
export function parseSeedArgs(argv: readonly string[], now: Date = new Date()): SeedArgs {
  let anchor: Date | null | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') continue;
    if (arg === '--fixture-dates') {
      if (anchor) throw new Error(`Use --anchor or --fixture-dates, not both. ${SEED_USAGE}`);
      anchor = null;
    } else if (arg === '--anchor' || arg.startsWith('--anchor=')) {
      if (anchor === null) {
        throw new Error(`Use --anchor or --fixture-dates, not both. ${SEED_USAGE}`);
      }
      const raw = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      const parsed = raw ? parseAnchor(raw) : null;
      if (!parsed) throw new Error(`--anchor needs a date such as 2026-10-17. ${SEED_USAGE}`);
      anchor = parsed;
    } else {
      throw new Error(`Unknown argument "${arg}". ${SEED_USAGE}`);
    }
  }
  return { anchor: anchor === undefined ? now : anchor };
}

/** `YYYY-MM-DD` is read as noon in Pakistan on that day; anything else must be an ISO instant. */
function parseAnchor(raw: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00+05:00`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? null : date;
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
