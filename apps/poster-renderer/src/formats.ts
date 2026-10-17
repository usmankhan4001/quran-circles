import type { PosterFormat } from '@qc/contracts';

/**
 * Output size of each format. Layout is drawn in design units: a unit is the page width divided by
 * 1080, so the story is 1 px per unit and the print pages scale the same layout.
 */
export interface FormatSpec {
  format: PosterFormat;
  output: 'png' | 'pdf';
  /** Viewport in CSS pixels. Print pages are their paper size at 96 dpi. */
  width: number;
  height: number;
  /** CSS size of the page box (`px` for images, `mm` for paper). */
  cssWidth: string;
  cssHeight: string;
  pdfFormat?: 'A4' | 'A3';
  /** Pixels per design unit. */
  unit: number;
  /** Safe margins in design units: the status app's own interface on a story, the printer's edge on paper. */
  safe: { top: number; side: number; bottom: number };
  /** Link previews carry no QR code (poster direction). */
  qr: boolean;
  orientation: 'portrait' | 'landscape';
}

const mmToPx = (mm: number): number => (mm * 96) / 25.4;

const print = (
  format: PosterFormat,
  pdfFormat: 'A4' | 'A3',
  wMm: number,
  hMm: number,
): FormatSpec => {
  const width = Math.round(mmToPx(wMm));
  return {
    format,
    output: 'pdf',
    width,
    height: Math.round(mmToPx(hMm)),
    cssWidth: `${wMm}mm`,
    cssHeight: `${hMm}mm`,
    pdfFormat,
    unit: mmToPx(wMm) / 1080,
    // About 12 mm on A4 and 17 mm on A3: inside every office printer's unprintable edge.
    safe: { top: 64, side: 64, bottom: 64 },
    qr: true,
    orientation: 'portrait',
  };
};

export const FORMAT_SPECS: Record<PosterFormat, FormatSpec> = {
  story: {
    format: 'story',
    output: 'png',
    width: 1080,
    height: 1920,
    cssWidth: '1080px',
    cssHeight: '1920px',
    unit: 1,
    // 96 px sides; WhatsApp and Instagram draw their own bars over the top 220 and bottom 280.
    safe: { top: 220, side: 96, bottom: 280 },
    qr: true,
    orientation: 'portrait',
  },
  print_a4: print('print_a4', 'A4', 210, 297),
  print_a3: print('print_a3', 'A3', 297, 420),
  link_preview: {
    format: 'link_preview',
    output: 'png',
    width: 1200,
    height: 630,
    cssWidth: '1200px',
    cssHeight: '630px',
    unit: 1200 / 1080,
    safe: { top: 48, side: 64, bottom: 48 },
    qr: false,
    orientation: 'landscape',
  },
};

export const CONTENT_TYPES = { png: 'image/png', pdf: 'application/pdf' } as const;
