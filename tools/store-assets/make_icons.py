"""Builds every app icon from the master logo.

    python3 make_icons.py [master.png] [out_dir]

The master is the full Quran Circles logo on white. Each platform gets the logo scaled so that
every inked pixel sits inside that platform's safe zone (checked pixel by pixel, not by bounding
box), then exported at the sizes the platform asks for. Nothing is redrawn: the master stays the
single source of truth, and re-running this script after a higher-resolution master arrives
regenerates everything.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
MASTER = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "source" / "quran-circles-logo-master.png"
VARIANT = sys.argv[3] if len(sys.argv) > 3 else "user"  # "admin" adds the amber Admin tag
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "build" / ("icons-admin" if VARIANT == "admin" else "icons")
BADGE_FONT = HERE.parents[1] / "apps" / "poster-renderer" / "assets" / "fonts" / "Figtree_700Bold.ttf"
WORK = 2048  # every icon is composed at this size, then downscaled
BRAND_GREEN = (10, 105, 56)  # #0A6938, sampled from the wordmark
INK = 12  # a pixel further than this from white counts as part of the logo


def load_master():
    rgb = Image.open(MASTER).convert("RGB")
    a = np.asarray(rgb).astype(np.int16)
    ys, xs = np.where((255 - a).max(2) > INK)
    logo = rgb.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    return add_admin_tag(logo) if VARIANT == "admin" else logo


def add_admin_tag(logo):
    """Puts an amber "ADMIN" pill under the logo, so the coordinator app is told apart at a glance."""
    from PIL import ImageDraw, ImageFont

    w, h = logo.size
    ph = round(h * 0.2)
    gap = round(h * 0.06)
    out = Image.new("RGB", (w, h + gap + ph), (255, 255, 255))
    out.paste(logo, (0, 0))
    d = ImageDraw.Draw(out)
    font = ImageFont.truetype(str(BADGE_FONT), round(ph * 0.62))
    tw = d.textlength("ADMIN", font=font)
    pw = round(tw + ph * 1.1)
    x0, y0 = (w - pw) // 2, h + gap
    d.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), radius=ph // 2, fill=(233, 185, 73))
    d.text((w / 2, y0 + ph / 2), "ADMIN", font=font, fill=(23, 32, 28), anchor="mm")
    return out


def unblend_white(rgb):
    """Turns a logo on white into the same logo on transparency (exact when composited on white)."""
    a = np.asarray(rgb).astype(np.float64)
    alpha = (255 - a).max(2) / 255.0
    safe = np.where(alpha > 0, alpha, 1)[..., None]
    col = 255 - (255 - a) / safe
    out = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def ink_points(logo):
    a = np.asarray(logo).astype(np.int16)
    ys, xs = np.where((255 - a).max(2) > INK)
    return xs, ys


def fit_scale(logo, inside):
    """Largest scale at which every ink pixel, centred on the canvas, passes `inside(dx, dy)`.

    dx and dy are offsets from the canvas centre as a fraction of the canvas side."""
    xs, ys = ink_points(logo)
    w, h = logo.size
    lo, hi = 0.05, 10.0
    for _ in range(40):
        s = (lo + hi) / 2
        dx = ((xs + 0.5) - w / 2) * s / WORK
        dy = ((ys + 0.5) - h / 2) * s / WORK
        if inside(dx, dy).all():
            lo = s
        else:
            hi = s
    return lo


def compose(logo, inside, background=(255, 255, 255, 255), transparent=False):
    s = fit_scale(logo, inside)
    w, h = round(logo.size[0] * s), round(logo.size[1] * s)
    art = logo.resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
    canvas = Image.new("RGBA", (WORK, WORK), (255, 255, 255, 0) if transparent else background)
    pos = ((WORK - w) // 2, (WORK - h) // 2)
    if transparent:
        canvas.alpha_composite(unblend_white(art), pos)
    else:
        canvas.paste(art, pos)
    return canvas, s


def save(img, path, size, alpha=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img.resize((size, size), Image.LANCZOS)
    if not alpha:
        flat = Image.new("RGB", out.size, (255, 255, 255))
        flat.paste(out, mask=out.getchannel("A") if out.mode == "RGBA" else None)
        out = flat
    out.save(path, optimize=True)
    return {"file": str(path.relative_to(OUT)), "size": f"{size}x{size}", "alpha": alpha}


def circle(r):
    return lambda dx, dy: dx * dx + dy * dy <= r * r


def square(half):
    return lambda dx, dy: (abs(dx) <= half) & (abs(dy) <= half)


def main():
    logo = load_master()
    files = []
    notes = {}

    # iOS: one opaque 1024 master (App Store and Xcode's single-size slot) plus the legacy set.
    # The squircle mask cuts the corners, so ink stays inside 84% of the square and a 46% circle.
    ios_inside = lambda dx, dy: square(0.40)(dx, dy) & circle(0.52)(dx, dy)
    ios, s = compose(logo, ios_inside)
    notes["ios_upscale_at_1024"] = round(s * 1024 / WORK, 2)
    files.append(save(ios, OUT / "ios" / "AppIcon-1024.png", 1024, alpha=False))
    for pt, scales in {20: (2, 3), 29: (2, 3), 38: (2, 3), 40: (2, 3), 60: (2, 3), 64: (2, 3), 68: (2,), 76: (2,), 83.5: (2,)}.items():
        for k in scales:
            px = round(pt * k)
            files.append(save(ios, OUT / "ios" / f"AppIcon-{pt:g}@{k}x.png", px, alpha=False))
    contents = {
        "images": [{"filename": "AppIcon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
        "info": {"author": "xcode", "version": 1},
    }
    (OUT / "ios" / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")

    # App Store marketing icon is the same opaque 1024. Google Play wants 512, 32-bit PNG.
    files.append(save(ios, OUT / "store" / "app-store-icon-1024.png", 1024, alpha=False))
    play, _ = compose(logo, square(0.42))
    files.append(save(play, OUT / "store" / "play-store-icon-512.png", 512, alpha=True))

    # Android adaptive icon: 108dp layers, 66dp safe circle (radius 33/108 of the side).
    fg, s = compose(logo, circle(33 / 108), transparent=True)
    notes["android_upscale_at_1024"] = round(s * 1024 / WORK, 2)
    files.append(save(fg, OUT / "android" / "adaptive-foreground-1024.png", 1024))
    bg = Image.new("RGBA", (WORK, WORK), (255, 255, 255, 255))
    files.append(save(bg, OUT / "android" / "adaptive-background-1024.png", 1024))
    mono = Image.merge("RGBA", (*[Image.new("L", (WORK, WORK), 255)] * 3, fg.getchannel("A")))
    files.append(save(mono, OUT / "android" / "adaptive-monochrome-1024.png", 1024))
    for dpi, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        legacy, _ = compose(logo, square(0.42))
        files.append(save(legacy, OUT / "android" / f"mipmap-{dpi}" / "ic_launcher.png", px))
        files.append(save(fg, OUT / "android" / f"mipmap-{dpi}" / "ic_launcher_foreground.png", round(px * 108 / 48)))

    # Web / PWA: "any" icons fill the square, maskable keeps ink inside the 80% safe circle.
    files.append(save(play, OUT / "web" / "icon-192.png", 192, alpha=False))
    files.append(save(play, OUT / "web" / "icon-512.png", 512, alpha=False))
    maskable, _ = compose(logo, circle(0.40))
    files.append(save(maskable, OUT / "web" / "icon-512-maskable.png", 512, alpha=False))
    files.append(save(maskable, OUT / "web" / "icon-192-maskable.png", 192, alpha=False))
    files.append(save(ios, OUT / "web" / "apple-touch-icon.png", 180, alpha=False))

    # Favicon: the wordmark is unreadable at 16 and 32 px, so those use the hand-and-Quran mark
    # (cropped from the same master); 48 and up use the full logo.
    master = Image.open(MASTER).convert("RGB")
    mark = master.crop((105, 70, 285, 250))
    mark_icon, _ = compose(mark, square(0.46))
    small = [mark_icon.resize((n, n), Image.LANCZOS).convert("RGB") for n in (16, 32)]
    big = play.resize((48, 48), Image.LANCZOS).convert("RGB")
    (OUT / "web").mkdir(parents=True, exist_ok=True)
    big.save(OUT / "web" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=small)
    files.append({"file": "web/favicon.ico", "size": "16,32,48", "alpha": False})
    files.append(save(mark_icon, OUT / "web" / "favicon-32.png", 32, alpha=False))
    files.append(save(mark_icon, OUT / "web" / "favicon-16.png", 16, alpha=False))

    (OUT / "manifest.json").write_text(json.dumps({"master": MASTER.name, "notes": notes, "files": files}, indent=2) + "\n")
    print(f"{len(files)} icon files written to {OUT}; notes: {notes}")


if __name__ == "__main__":
    main()
