import qrcode from 'qrcode-generator';

/** Modules of white around the code; the QR standard asks for at least four. */
export const QUIET_ZONE = 4;

export interface QrCode {
  /** Dark modules, row by row, without the quiet zone. */
  matrix: boolean[][];
  /** An `<svg>` drawing the code with its quiet zone on a white square, scaled to its box. */
  svg: string;
}

/**
 * Encodes `text` (a deep link) as a QR code with error correction M, which still scans with some
 * print damage and keeps the code small enough for a link of about 80 characters.
 */
export function makeQr(text: string): QrCode {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const matrix = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
  // One path; horizontal runs of dark modules are joined so the edges stay crisp.
  let d = '';
  matrix.forEach((row, r) => {
    let c = 0;
    while (c < n) {
      if (!row[c]) {
        c += 1;
        continue;
      }
      const start = c;
      while (c < n && row[c]) c += 1;
      d += `M${start + QUIET_ZONE} ${r + QUIET_ZONE}h${c - start}v1h${start - c}z`;
    }
  });
  const size = n + QUIET_ZONE * 2;
  const svg =
    `<svg viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-hidden="true">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<path d="${d}" fill="#000000"/></svg>`;
  return { matrix, svg };
}
