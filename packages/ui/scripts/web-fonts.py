"""Writes the WOFF2 web copies of the bundled fonts into assets/fonts/web/.

Run from packages/ui with fontTools 4.67.0 and brotli 1.2.0:

    python3 -m venv /tmp/fonts && /tmp/fonts/bin/pip install fonttools==4.67.0 brotli==1.2.0
    /tmp/fonts/bin/python scripts/web-fonts.py

WOFF2 is the same font in a compressed container: every table and glyph is kept, nothing is
subset. Only Figtree (SIL OFL 1.1, no reserved font name) and Mehr Nastaliq Web (CC BY-SA 4.0)
are converted. The KFGQPC licence forbids converting its file, so it is never touched here.
Licences and checksums: assets/fonts/LICENSES.md.
"""

import os
import sys

from fontTools.ttLib import woff2

HERE = os.path.dirname(os.path.abspath(__file__))
UI = os.path.dirname(HERE)
FIGTREE = os.path.join(
    UI, "node_modules", "@expo-google-fonts", "figtree"
)
SOURCES = {
    "Figtree-400.woff2": os.path.join(FIGTREE, "400Regular", "Figtree_400Regular.ttf"),
    "Figtree-500.woff2": os.path.join(FIGTREE, "500Medium", "Figtree_500Medium.ttf"),
    "Figtree-600.woff2": os.path.join(FIGTREE, "600SemiBold", "Figtree_600SemiBold.ttf"),
    "Figtree-700.woff2": os.path.join(FIGTREE, "700Bold", "Figtree_700Bold.ttf"),
    "Figtree-800.woff2": os.path.join(FIGTREE, "800ExtraBold", "Figtree_800ExtraBold.ttf"),
    "MehrNastaliqWeb-Regular.woff2": os.path.join(
        UI, "assets", "fonts", "MehrNastaliqWeb-Regular.ttf"
    ),
}


def main() -> int:
    out_dir = os.path.join(UI, "assets", "fonts", "web")
    os.makedirs(out_dir, exist_ok=True)
    for name, source in SOURCES.items():
        if "KFGQPC" in source:
            raise SystemExit("The KFGQPC font must never be converted.")
        target = os.path.join(out_dir, name)
        woff2.compress(source, target)
        print(f"{name}: {os.path.getsize(source)} -> {os.path.getsize(target)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
