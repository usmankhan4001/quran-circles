import type { BrowserContextOptions, Page } from '@playwright/test';

/**
 * The stand-in for the reference low-end Android phone (docs/agents/briefs/quality.md, "No
 * reference phone yet"): a small screen, a 2x display, touch, a 6x slower CPU and a slow mobile
 * network, all emulated in desktop Chromium. Numbers measured this way are provisional; the
 * real-device checks are listed in docs/quality/low-end-budgets.md.
 */
export const LOW_END_DEVICE = {
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 12; QC-LowEnd) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/141.0.0.0 Mobile Safari/537.36',
  locale: 'en-GB',
  timezoneId: 'Asia/Karachi',
} as const satisfies BrowserContextOptions;

export interface NetworkProfile {
  name: string;
  /** Round-trip latency added to every request, in milliseconds. */
  latencyMs: number;
  /** Bytes per second. */
  downloadBps: number;
  uploadBps: number;
}

/** Chrome DevTools' "Slow 4G" preset (1.44 Mbit/s down, 562.5 ms round trip). */
export const SLOW_4G: NetworkProfile = {
  name: 'Slow 4G',
  latencyMs: 562.5,
  downloadBps: (1.6 * 1024 * 1024 * 0.9) / 8,
  uploadBps: (750 * 1024 * 0.9) / 8,
};

/** Chrome DevTools' "3G" preset (0.4 Mbit/s down, 2 s round trip): the bad-evening case. */
export const SLOW_3G: NetworkProfile = {
  name: '3G',
  latencyMs: 2000,
  downloadBps: (500 * 1024 * 0.8) / 8,
  uploadBps: (500 * 1024 * 0.8) / 8,
};

export const CPU_SLOWDOWN = 6;

/**
 * Applies CPU and network throttling to one page through the Chrome DevTools Protocol. Network
 * throttling covers requests to 127.0.0.1 too, so the local stack behaves like a far server.
 */
export async function throttle(
  page: Page,
  options: { cpu?: number; network?: NetworkProfile | null } = {},
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.cpu ?? CPU_SLOWDOWN });
  const network = options.network === undefined ? SLOW_4G : options.network;
  if (network) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: network.latencyMs,
      downloadThroughput: network.downloadBps,
      uploadThroughput: network.uploadBps,
    });
  }
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? Number.NaN)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function worst(values: readonly number[]): number {
  return values.length === 0 ? Number.NaN : Math.max(...values);
}
