"""Adds an iPhone-style status bar above web captures, so the device frame's camera island sits
on the status bar instead of the app's header.

    python3 add_status_bar.py <raw dir> <out dir>

Each PNG in <raw dir> (and its en/ and ur/ sub-folders) gets a 54 pt band on top in the colour of
the capture's first row, with "9:41" and signal, wifi and battery marks, light or dark to match.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = Path(__file__).resolve().parent / "mockups" / "fonts" / "Figtree-700.ttf"


def add_bar(src, dst):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    k = w / 390  # points to pixels
    band = round(54 * k)
    top = np.asarray(im)[:4].reshape(-1, 3)
    color = tuple(int(v) for v in np.median(top, 0))
    light = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) < 140
    ink = (255, 255, 255) if light else (17, 24, 22)
    out = Image.new("RGB", (w, h + band), color)
    out.paste(im, (0, band))
    d = ImageDraw.Draw(out)
    font = ImageFont.truetype(str(FONT), round(17 * k))
    d.text((round(52 * k), band * 0.56), "9:41", font=font, fill=ink, anchor="lm")
    cy = band * 0.56
    x = w - round(30 * k)
    # battery
    bw, bh = 25 * k, 12 * k
    d.rounded_rectangle((x - bw, cy - bh / 2, x, cy + bh / 2), radius=3.5 * k, outline=ink, width=max(1, round(1 * k)))
    d.rounded_rectangle((x - bw + 2 * k, cy - bh / 2 + 2 * k, x - 2 * k, cy + bh / 2 - 2 * k), radius=2 * k, fill=ink)
    # wifi (three arcs)
    wx = x - bw - 14 * k
    for i, r in enumerate((9, 6, 3)):
        r *= k
        d.arc((wx - r, cy + 4 * k - r, wx + r, cy + 4 * k + r), 225, 315, fill=ink, width=max(1, round(1.8 * k)))
    # signal bars
    sx = wx - 26 * k
    for i in range(4):
        bh2 = (4 + i * 2.6) * k
        d.rounded_rectangle((sx + i * 4.6 * k, cy + 5 * k - bh2, sx + i * 4.6 * k + 3 * k, cy + 5 * k), radius=1 * k, fill=ink)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, optimize=True)


def main():
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    for src in sorted(raw.rglob("*.png")):
        add_bar(src, out / src.relative_to(raw))
        print(src.relative_to(raw))


if __name__ == "__main__":
    main()
