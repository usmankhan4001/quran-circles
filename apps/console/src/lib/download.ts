/**
 * Hands a text file to the browser's download. A byte order mark is added so Excel reads Urdu
 * names as UTF-8. The file never leaves the browser and its contents are never logged.
 */
export function saveTextFile(filename: string, text: string, mime = 'text/csv'): void {
  const body = text.startsWith('\uFEFF') ? text : `\uFEFF${text}`;
  const url = URL.createObjectURL(new Blob([body], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Hands bytes (a poster's PNG or PDF) to the browser's download. Nothing is kept or logged. */
export function saveBinaryFile(filename: string, bytes: Uint8Array, mime: string): void {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy.buffer], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** `2027-02-15` in Pakistan time, for file names. */
export function todayStamp(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(now);
}
