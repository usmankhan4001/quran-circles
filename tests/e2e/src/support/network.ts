/**
 * How browser tests are kept on this machine without intercepting requests.
 *
 * Chromium is launched with a host-resolver rule that makes every host name and every IP address
 * unresolvable except the loopback names, and with no proxy (a proxy taken from the environment
 * would resolve outside hosts itself). A request to anywhere else fails inside Chromium's network
 * stack with ERR_NAME_NOT_RESOLVED before a connection is attempted. Nothing goes through
 * Playwright's request routing, so a request made while the page's main thread is busy is not
 * held up by a round trip to the test process.
 *
 * A host can be pointed at a server on this machine instead (`maps`), as the quality project does
 * for the Quran text service (quality/quran-stub.ts).
 */

/** The only hosts a browser test may reach. */
export const LOOPBACK_HOSTS = ['localhost', '127.0.0.1'] as const;

/** The Quran text service the apps read; answered locally in the quality project. */
export const QURAN_SOURCE_HOST = 'api.alquran.cloud';

/** Chromium launch arguments: no proxy, nothing resolves but loopback and the `maps` given. */
export function localOnlyLaunchArgs(maps: Readonly<Record<string, string>> = {}): string[] {
  const rules = [
    // A specific MAP must come before the catch-all: the first matching MAP wins.
    ...Object.entries(maps).map(([host, target]) => `MAP ${host} ${target}`),
    'MAP * ~NOTFOUND',
    ...LOOPBACK_HOSTS.map((host) => `EXCLUDE ${host}`),
  ];
  // `--no-proxy-server` alone is ignored by Chromium's headless shell (Playwright's default
  // headless browser), which still takes a proxy from the environment; `direct://` is honoured by
  // both builds.
  return [
    '--no-proxy-server',
    '--proxy-server=direct://',
    `--host-resolver-rules=${rules.join(', ')}`,
  ];
}

const STUB_PORT_VARIABLE = 'QC_QURAN_STUB_PORT';

/**
 * The loopback port of the local Quran text service. The config picks it once, in the runner,
 * and the workers inherit it through the environment, so the launch rule and the server agree.
 * Set QC_QURAN_STUB_PORT to choose it.
 */
export function quranStubPort(): number {
  const given = Number(process.env[STUB_PORT_VARIABLE]);
  if (Number.isInteger(given) && given > 0 && given < 65536) return given;
  // Derived from the runner's process id, so two runs on one machine rarely collide.
  const port = 41000 + (process.pid % 9000);
  process.env[STUB_PORT_VARIABLE] = String(port);
  return port;
}
