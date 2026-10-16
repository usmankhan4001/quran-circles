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
