const HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for an HTML body or a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML[c] ?? c);
}

/**
 * Allows only http(s) and mailto links, or a whole `{{{variable}}}` placeholder (provider template source), through; anything else (javascript:, data:) becomes `#`.
 * The result is escaped for an attribute.
 */
export function safeUrl(value: string): string {
  const url = value.trim();
  return /^(https?:\/\/|mailto:|\{\{\{[A-Za-z_]+\}\}\}$)/i.test(url) ? escapeHtml(url) : '#';
}

/** Strips line breaks so a value cannot split a subject or a text line. */
export function oneLine(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
}
