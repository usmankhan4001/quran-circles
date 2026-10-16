import { E164_PATTERN } from '@qc/contracts';

/**
 * Turns what a person types into an E.164 number, or null when it cannot be one.
 * Pakistan is the default country: `0300 1234567`, `300-1234567`, `+92 300 1234567` and
 * `0092 300 1234567` all become `+923001234567`. Other countries need the `+` or `00` prefix.
 */
export function normalizePhone(input: string): string | null {
  const stripped = input.replace(/[\s\-().]/g, '');
  if (!stripped || /[^0-9+]/.test(stripped)) return null;
  let candidate: string;
  if (stripped.startsWith('+')) candidate = stripped;
  else if (stripped.startsWith('00')) candidate = `+${stripped.slice(2)}`;
  else if (stripped.startsWith('92') && stripped.length === 12) candidate = `+${stripped}`;
  else if (stripped.startsWith('0')) candidate = `+92${stripped.slice(1)}`;
  else candidate = `+92${stripped}`;
  if (candidate.slice(1).includes('+')) return null;
  return E164_PATTERN.test(candidate) ? candidate : null;
}

/** `+923001234567` becomes `+92 300 1234567` for reading. Other numbers are left as they are. */
export function formatPhoneDisplay(e164: string): string {
  const m = /^\+92(\d{3})(\d{7})$/.exec(e164);
  return m ? `+92 ${m[1]} ${m[2]}` : e164;
}

/** `tel:` link that opens the phone dialler. */
export function telUrl(e164: string): string {
  return `tel:${e164}`;
}

/** `wa.me` link that opens a WhatsApp chat with the number. The text is optional. */
export function whatsappUrl(e164: string, text?: string): string {
  const digits = e164.replace(/^\+/, '');
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

export type ContactKind = 'call' | 'whatsapp';

export function contactUrl(kind: ContactKind, e164: string): string {
  return kind === 'call' ? telUrl(e164) : whatsappUrl(e164);
}
