import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe('the device connection state on native', () => {
  it('has no platform source, so failed calls stay the only signal', async () => {
    const { deviceNetworkStatus } = await import('./networkStatus');
    expect(deviceNetworkStatus()).toBeNull();
  });
});
