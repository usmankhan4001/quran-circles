import { chromium, type Browser, type Page } from 'playwright-core';
import { FIT_SCRIPT } from '../fit';

/** PNG width and height from the IHDR chunk. */
export function pngSize(png: Buffer): { width: number; height: number } {
  if (png.subarray(1, 4).toString('latin1') !== 'PNG') throw new Error('not a PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export interface PdfFacts {
  pages: number;
  mediaBox: [number, number];
  fonts: string[];
}

/** What a test needs from Chrome's PDF: page count, page size in points and embedded font names. */
export function pdfFacts(pdf: Buffer): PdfFacts {
  const text = pdf.toString('latin1');
  if (!text.startsWith('%PDF-')) throw new Error('not a PDF');
  const pages = (text.match(/\/Type \/Page\b(?!s)/g) ?? []).length;
  const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
  const fonts = [
    ...new Set([...text.matchAll(/\/BaseFont \/[A-Z]{6}\+([A-Za-z-]+)/g)].map((m) => m[1] ?? '')),
  ];
  return { pages, mediaBox: [Number(box?.[1] ?? 0), Number(box?.[2] ?? 0)], fonts };
}

/**
 * A separate, ordinary browser page for inspecting results: reads pixels of a PNG, and lays out a
 * template's HTML the same way the renderer does to find boxes and the fonts Chromium used.
 */
export class Inspector {
  private constructor(
    private readonly browser: Browser,
    readonly page: Page,
  ) {}

  static async start(): Promise<Inspector> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    return new Inspector(browser, page);
  }

  /** RGB of the PNG at each point. */
  async pixels(
    png: Buffer,
    points: Array<[number, number]>,
  ): Promise<Array<[number, number, number]>> {
    await this.page.setViewportSize({ width: 800, height: 600 });
    await this.page.setContent('<canvas id="c"></canvas>');
    // A string, so the test build needs no DOM types and no helper leaks into the page.
    const script = `(async ({ src, points }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.getElementById('c');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return points.map(([x, y]) => Array.from(ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data.slice(0, 3)));
    })(${JSON.stringify({ src: `data:image/png;base64,${png.toString('base64')}`, points })})`;
    return (await this.page.evaluate(script)) as Array<[number, number, number]>;
  }

  /** The font size, in pixels, the fit step chose for a box. */
  async fontSize(selector: string): Promise<number> {
    const script = `parseFloat(document.querySelector(${JSON.stringify(selector)}).style.fontSize)`;
    return (await this.page.evaluate(script)) as number;
  }

  /** Lays out the HTML at the given size and runs the same fit step as the renderer. */
  async layout(html: string, width: number, height: number, unit: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    await this.page.setContent(html);
    await this.page.evaluate('document.fonts.ready');
    await this.page.evaluate(`(${FIT_SCRIPT})(${unit})`);
  }

  async rect(selector: string): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`no box for ${selector}`);
    return box;
  }

  /** The font families Chromium actually used for the text directly inside each matching node. */
  async fontsUsed(selector: string): Promise<Record<string, number>> {
    const cdp = await this.page.context().newCDPSession(this.page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
    const used: Record<string, number> = {};
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      for (const f of fonts) {
        // Chromium reports a face's full name ("Figtree SemiBold"); group by family.
        const family = f.familyName.startsWith('Figtree') ? 'Figtree' : f.familyName;
        used[family] = (used[family] ?? 0) + f.glyphCount;
      }
    }
    await cdp.detach();
    return used;
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}
