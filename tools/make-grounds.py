"""Generate the per-element battlefield grounds (public/ground/<el>.webp).

Every texture is SEAMLESS (all noise is FFT-filtered, so it is periodic, and
every stroke is drawn at its wrapped copies too), opaque, and kept dark: cards
sit on top of it and have to stay the brightest thing on a tile.

Run from the repo root:  python tools/make-grounds.py [out_dir]
Needs numpy + Pillow.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

N = 512
OUT = sys.argv[1] if len(sys.argv) > 1 else "public/ground"


def noise(seed, lo, hi=None, power=1.0):
    """Periodic band-limited noise in [0,1]: white noise filtered in frequency
    space. `lo` is the smallest wavelength kept (px); `power` tilts toward
    large features."""
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.standard_normal((N, N)))
    fy = np.fft.fftfreq(N)[:, None]
    fx = np.fft.fftfreq(N)[None, :]
    k = np.sqrt(fx * fx + fy * fy) + 1e-9
    m = np.exp(-(k * lo) ** 2) if lo else np.ones_like(k)
    if power:
        m = m / (k ** power)
    if hi:
        m *= 1 - np.exp(-(k * hi) ** 2)
    m[0, 0] = 0
    n = np.real(np.fft.ifft2(f * m))
    return (n - n.min()) / (n.max() - n.min())


def lit(h, strength=3.0):
    """Lambert from the top-left (the board's key light); periodic gradients."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    l = np.array([-0.55, -0.55, 0.63])
    l /= np.linalg.norm(l)
    d = (-dx * l[0] - dy * l[1] + l[2]) / np.sqrt(dx * dx + dy * dy + 1)
    return np.clip(d, 0, 1)


def ramp(t, stops):
    """Map t in [0,1] through colour stops [(pos, (r,g,b)), ...]."""
    t = np.clip(t, 0, 1)
    ps = [p for p, _ in stops]
    cs = np.array([c for _, c in stops], float)
    return np.stack([np.interp(t, ps, cs[:, ch]) for ch in range(3)], -1)


def wrapdraw(img, items, fn):
    """Draw every item at the 9 wrapped offsets, so strokes cross the seam."""
    d = ImageDraw.Draw(img)
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            for it in items:
                fn(d, it, ox, oy)


def save(name, rgb):
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(f"{OUT}/{name}.webp", quality=82, method=6)


def shade(rgb, light, amb=0.55):
    return rgb * (amb + (1 - amb) * light[..., None] * 1.35)


def cracks(seed, cells=14):
    """Distance to the nearest Voronoi edge (periodic, warped) — 0 on a crack."""
    r = np.random.default_rng(seed)
    pts = r.uniform(0, N, (cells, 2))
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    warp = (noise(seed + 50, 25, power=0.8) - 0.5) * 30
    xx, yy = xx + warp, yy + np.roll(warp, 97, 0)
    d1 = np.full((N, N), 1e9)
    d2 = np.full((N, N), 1e9)
    for px, py in pts:
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d = np.hypot(xx - px - ox, yy - py - oy)
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d))
                d1 = np.where(closer, d, d1)
    return d2 - d1


def strokes(seed, count, length, angle_deg, spread, colour):
    r = np.random.default_rng(seed)
    out = []
    for _ in range(count):
        x, y = r.uniform(0, N, 2)
        L = r.uniform(*length)
        a = math.radians(r.normal(angle_deg, spread))
        out.append((x, y, x + L * math.cos(a), y + L * math.sin(a), colour(r), int(r.choice([1, 1, 2]))))
    out.sort(key=lambda s: s[1])  # lower (nearer) strokes over higher ones
    return out


def line(d, s, ox, oy):
    d.line((s[0] + ox, s[1] + oy, s[2] + ox, s[3] + oy), fill=s[4], width=s[5])


# ── LEAF: a grass meadow ─────────────────────────────────────────────────────
def leaf():
    base = ramp(noise(1, 40, power=0.6), [(0, (22, 44, 16)), (0.5, (34, 66, 22)), (1, (48, 84, 28))])
    img = Image.fromarray(base.astype(np.uint8), "RGB")

    def colour(r):
        g = r.uniform(0.55, 1.3)
        if r.random() < 0.06:
            return (int(96 * g), int(104 * g), int(44 * g))  # a dry blade
        return (int(40 * g), int(94 * g), int(30 * g))

    wrapdraw(img, strokes(11, 9000, (7, 16), -90, 18, colour), line)
    a = np.asarray(img).astype(float)
    r = np.random.default_rng(12)
    for _ in range(60):  # a few clover/flower specks
        x, y = r.integers(0, N, 2)
        c = [(200, 190, 110), (180, 140, 180), (210, 210, 190)][r.integers(0, 3)]
        a[np.ix_([(y - 1) % N, y], [(x - 1) % N, x])] = np.array(c) * 0.7
    a *= (0.7 + 0.45 * noise(3, 60, power=0.5))[..., None]
    save("leaf", a * 0.92)


# ── PYRO: cracked basalt with ember seams ────────────────────────────────────
def pyro():
    h = noise(5, 6, power=1.1) * 0.6 + noise(6, 2, power=0.8) * 0.4
    e = cracks(7, 12)
    seam = np.exp(-(e / 2.6) ** 2)
    h = h - seam * 0.5
    base = ramp(h, [(0, (16, 13, 13)), (0.5, (38, 31, 29)), (1, (64, 54, 48))])
    a = shade(base, lit(h, 4))
    glow = np.exp(-(e / 5.5) ** 2) * (0.55 + 0.45 * noise(8, 30, power=0.5))
    hot = np.exp(-(e / 1.6) ** 2)
    a = a * (1 - seam[..., None] * 0.8) + glow[..., None] * np.array([150, 40, 6]) * 0.6 + hot[..., None] * np.array([120, 90, 20]) * 0.55
    save("pyro", a)


# ── AQUA: shallow water over sand ────────────────────────────────────────────
def aqua():
    sand = noise(9, 3, power=0.7)
    ripple = noise(10, 14, power=1.0)
    c1 = np.abs(noise(11, 18, power=1.0) - 0.5)
    c2 = np.abs(noise(12, 22, power=1.0) - 0.5)
    caustic = np.exp(-(c1 / 0.035) ** 2) * 0.6 + np.exp(-(c2 / 0.03) ** 2) * 0.5
    base = ramp(sand * 0.5 + ripple * 0.5, [(0, (14, 44, 58)), (0.5, (22, 66, 80)), (1, (36, 90, 98))])
    a = shade(base, lit(ripple * 0.6 + sand * 0.4, 5), 0.6)
    a += caustic[..., None] * np.array([70, 140, 150]) * 0.28
    save("aqua", a * 0.85)


# ── GALE: wind-combed steppe ─────────────────────────────────────────────────
def gale():
    base = ramp(noise(14, 50, power=0.6), [(0, (44, 52, 50)), (1, (70, 80, 72))])
    img = Image.fromarray(base.astype(np.uint8), "RGB")

    def colour(r):
        g = r.uniform(0.75, 1.3)
        if r.random() < 0.25:
            return (int(120 * g), int(116 * g), int(86 * g))
        return (int(92 * g), int(104 * g), int(90 * g))

    wrapdraw(img, strokes(13, 6500, (10, 26), -28, 7, colour), line)  # all combed one way
    a = np.asarray(img).astype(float)
    a *= (0.66 + 0.45 * noise(15, 70, power=0.4))[..., None]
    save("gale", a * 0.82)


# ── BOLT: city asphalt under violet neon ─────────────────────────────────────
def bolt():
    # Fine aggregate: high-frequency grain, a scatter of lighter stones, and
    # broad wear so no tile reads as a flat colour.
    grain = noise(16, 1.0, power=0.2)
    wear = noise(17, 70, power=0.5)
    h = grain * 0.6 + noise(19, 3, power=0.6) * 0.4
    r = np.random.default_rng(16)
    stones = np.zeros((N, N))
    ys, xs = r.integers(0, N, (2, 2600))
    stones[ys, xs] = r.uniform(0.4, 1.0, 2600)
    base = ramp(wear, [(0, (22, 23, 25)), (1, (38, 39, 42))])
    a = shade(base, lit(h, 2.5), 0.6)
    a += stones[..., None] * np.array([42, 42, 44])
    # Tar-sealed cracks: dark, a touch glossy along the edge.
    e = cracks(18, 7)
    tar = np.exp(-(e / 1.6) ** 2)
    a = a * (1 - tar[..., None] * 0.6) + np.exp(-((e - 2.6) / 0.9) ** 2)[..., None] * np.array([16, 16, 20])
    # Neon: wet sheen catching violet signage, and a couple of glowing dashes.
    sheen = np.clip(noise(20, 40, power=0.7) * 1.6 - 0.9, 0, 1) ** 1.5
    a += sheen[..., None] * np.array([70, 30, 110]) * 0.5
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    for y0, dash in ((N * 0.28, 70), (N * 0.78, 54)):
        on = ((xx + y0) % (dash * 2)) < dash
        d = np.abs(((yy - y0 + N / 2) % N) - N / 2)
        a += (np.exp(-(d / 2.0) ** 2) * on)[..., None] * np.array([170, 90, 255]) * 1.1
        a += (np.exp(-(d / 9) ** 2) * on)[..., None] * np.array([70, 24, 120]) * 0.6
    save("bolt", a)


# ── BORE: dry packed earth and gravel ────────────────────────────────────────
def bore():
    r = np.random.default_rng(19)
    h = noise(20, 5, power=1.0) * 0.6 + noise(21, 1.5, power=0.5) * 0.4
    h -= np.exp(-(cracks(22, 22) / 1.8) ** 2) * 0.35
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    for _ in range(140):  # pebbles
        cx, cy = r.uniform(0, N, 2)
        rad = r.uniform(2.5, 7)
        dx = (xx - cx + N / 2) % N - N / 2
        dy = (yy - cy + N / 2) % N - N / 2
        h += np.clip(1 - (dx * dx + dy * dy) / rad ** 2, 0, 1) ** 0.5 * 0.35
    base = ramp(noise(23, 50, power=0.5), [(0, (66, 48, 32)), (1, (96, 74, 50))])
    save("bore", shade(base, lit(h, 4), 0.5) * 0.86)


# ── DUSK: grave soil, dead grass, a violet chill ─────────────────────────────
def dusk():
    h = noise(25, 4, power=1.0) * 0.7 + noise(26, 1.5, power=0.5) * 0.3
    base = ramp(noise(27, 45, power=0.6), [(0, (24, 18, 30)), (0.6, (38, 30, 44)), (1, (50, 40, 56))])
    a = shade(base, lit(h, 4), 0.55)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")

    def colour(r):
        g = r.uniform(0.7, 1.2)
        return (int(70 * g), int(62 * g), int(60 * g))

    wrapdraw(img, strokes(24, 1800, (5, 12), -90, 30, colour), line)
    a = np.asarray(img).astype(float)
    a += (noise(28, 90, power=0.4) ** 2)[..., None] * np.array([26, 12, 40])
    save("dusk", a * 0.9)


# ── DAWN: golden bricks ──────────────────────────────────────────────────────
def dawn():
    rows, cols = 10, 4            # whole bricks per texture, so it tiles
    BH, BW = N / rows, N / cols
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    row = np.floor(yy / BH)
    shift = (row % 2) * BW / 2    # running bond: every other course offset
    col = np.floor(((xx + shift) % N) / BW)
    u = ((xx + shift) % N) - col * BW
    v = yy - row * BH
    edge = np.minimum(np.minimum(u, BW - u), np.minimum(v, BH - v))
    mortar = np.clip(1 - (edge - 1.5) / 2.0, 0, 1)  # ~2-3px joints
    bevel = np.clip(edge / 7, 0, 1) ** 0.6           # rounded brick shoulders
    # Per-brick colour: hash the brick's index so each one is a slightly
    # different fire of gold.
    k = (row * 7919 + col * 104729) % 9973
    tone = (np.sin(k * 12.9898) * 43758.5453) % 1.0
    h = bevel * 0.7 + noise(30, 2, power=0.6) * 0.3 - mortar * 0.5
    brick = ramp(tone * 0.7 + noise(31, 30, power=0.6) * 0.3,
                 [(0, (150, 104, 30)), (0.5, (184, 138, 44)), (1, (212, 168, 66))])
    a = shade(brick, lit(h, 5), 0.5)
    a = a * (1 - mortar[..., None]) + mortar[..., None] * np.array([40, 28, 16])
    a *= (0.8 + 0.3 * noise(32, 80, power=0.4))[..., None]  # soot and sun
    save("dawn", a * 0.66)


ALL = (leaf, pyro, aqua, gale, bolt, bore, dusk, dawn)

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fn in ALL:
        fn()
        print(fn.__name__)
