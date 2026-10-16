import { Linking } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contactUrl, openContact } from './contact';

describe('openContact', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the link it is given', () => {
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    openContact('call', 'tel:+923001234567');
    expect(open).toHaveBeenCalledWith('tel:+923001234567');
  });

  it('swallows a failure to open, such as no WhatsApp installed', async () => {
    const open = vi.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    expect(() => openContact('whatsapp', 'https://wa.me/923001234567')).not.toThrow();
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('builds the links for both buttons', () => {
    expect(contactUrl('call', '+923001234567')).toBe('tel:+923001234567');
    expect(contactUrl('whatsapp', '+923001234567')).toBe('https://wa.me/923001234567');
  });
});
