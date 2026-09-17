"""Build the small copies of the card art that every grid and token actually shows.

    python tools/make-thumbs.py            # only what is missing or out of date
    python tools/make-thumbs.py --force    # rebuild all of them

The plates in `public/cards` are 1000px tall because the card detail view and
the gallery lightbox show them full size. Nothing else does: grid tiles are
78-96px wide, a hand card is 96px, an opponent's revealed card is 26px. A
browser decodes an image at its NATURAL size no matter how small it is drawn,
so a 433-plate gallery was holding ~700 MB of decoded bitmap -- measured, not
estimated -- which is what made phones stutter and reload the tab.

These copies are 500px tall (about 400 wide): ~49 KB instead of ~240 KB on the
wire, and a third of the decode memory, while still out-resolving a 96px tile
on a 3x phone screen.

Run this after dropping new art in `public/cards`. art.test.ts fails if a plate
has no copy here, because a missing one is invisible: the tile just renders
empty. See public/cards/README.md.
"""
import os
import sys

from PIL import Image

QUALITY = 80
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# folder -> the height its copies get. Cards are portrait plates drawn as tiles
# up to ~96px wide; spell art is square and drawn as a 20-26px chip in the tray,
# so it can go much smaller. The one place each full size is still used (card
# detail / gallery lightbox, and the cast flash) loads the original.
SIZES = {"cards": 500, "spells": 240}


def build(folder: str, height: int, force: bool) -> tuple[int, int, int, int, int]:
    src_dir = os.path.join(ROOT, "public", folder)
    out_dir = os.path.join(src_dir, "thumb")
    os.makedirs(out_dir, exist_ok=True)
    names = sorted(f for f in os.listdir(src_dir) if f.endswith(".webp"))
    built = skipped = 0
    src_bytes = out_bytes = 0
    for name in names:
        src, out = os.path.join(src_dir, name), os.path.join(out_dir, name)
        src_bytes += os.path.getsize(src)
        if not force and os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
            skipped += 1
            out_bytes += os.path.getsize(out)
            continue
        im = Image.open(src)
        width = max(1, round(im.width * height / im.height))
        im.convert("RGB").resize((width, height), Image.LANCZOS).save(
            out, "WEBP", quality=QUALITY, method=6,
        )
        built += 1
        out_bytes += os.path.getsize(out)
    # A copy whose original was deleted would linger and quietly rot.
    stale = [f for f in os.listdir(out_dir) if f.endswith(".webp") and f not in set(names)]
    for f in stale:
        os.remove(os.path.join(out_dir, f))
    return built, skipped, len(stale), src_bytes, out_bytes


def main() -> None:
    force = "--force" in sys.argv
    mb = 1024 * 1024
    for folder, height in SIZES.items():
        built, skipped, stale, src_bytes, out_bytes = build(folder, height, force)
        print(f"{folder}: built {built}, up to date {skipped}, removed {stale} stale — "
              f"{src_bytes / mb:.1f} MB of originals -> {out_bytes / mb:.1f} MB of copies")


if __name__ == "__main__":
    main()
